create table if not exists private.discovery_review_learning(
  seed_query text primary key,
  sample_count integer not null default 0,
  approved_count integer not null default 0,
  rejected_count integer not null default 0,
  preference_score integer not null default 0 check(preference_score between -10 and 10),
  last_decision_at timestamptz,
  refreshed_at timestamptz not null default now()
);

revoke all on table private.discovery_review_learning from public,anon,authenticated;

create or replace function private.refresh_discovery_review_learning()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_rows integer:=0;
begin
  with learned as (
    select
      lower(trim(seed_query)) as seed_query,
      count(*)::integer as sample_count,
      count(*) filter(where status='approved')::integer as approved_count,
      count(*) filter(where status='rejected')::integer as rejected_count,
      max(decided_at) as last_decision_at,
      least(10,greatest(-10,round(
        (
          (count(*) filter(where status='approved') - count(*) filter(where status='rejected'))::numeric
          / greatest(count(*),1)::numeric
        ) * 10
        * least(1.0,count(*)::numeric/5.0)
      )))::integer as preference_score
    from private.discovery_candidates
    where status in ('approved','rejected')
      and decided_at>=now()-interval '180 days'
      and trim(coalesce(seed_query,''))<>''
    group by lower(trim(seed_query))
  ), upserted as (
    insert into private.discovery_review_learning(
      seed_query,sample_count,approved_count,rejected_count,preference_score,last_decision_at,refreshed_at
    )
    select seed_query,sample_count,approved_count,rejected_count,preference_score,last_decision_at,now()
    from learned
    on conflict(seed_query) do update set
      sample_count=excluded.sample_count,
      approved_count=excluded.approved_count,
      rejected_count=excluded.rejected_count,
      preference_score=excluded.preference_score,
      last_decision_at=excluded.last_decision_at,
      refreshed_at=now()
    returning seed_query
  )
  select count(*)::integer into v_rows from upserted;

  delete from private.discovery_review_learning l
  where not exists(
    select 1
    from private.discovery_candidates c
    where lower(trim(c.seed_query))=l.seed_query
      and c.status in ('approved','rejected')
      and c.decided_at>=now()-interval '180 days'
  );

  return jsonb_build_object('ok',true,'learned_seeds',v_rows,'finished_at',now());
end;
$function$;

revoke all on function private.refresh_discovery_review_learning() from public,anon,authenticated;
grant execute on function private.refresh_discovery_review_learning() to service_role;

create or replace function private.refresh_discovery_candidate_pre_review()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_evaluated integer := 0;
  v_approve integer := 0;
  v_review integer := 0;
  v_skip integer := 0;
begin
  perform private.refresh_discovery_review_learning();

  with candidate_match as (
    select
      c.id,
      count(distinct r.id)::integer as matched_restaurants
    from private.discovery_candidates c
    left join public.restaurants r
      on r.trend_autopilot_mode <> 'off'
     and (
       c.geo=''
       or (c.geo='RS' and (
         lower(coalesce(r.country,'')) like '%serb%'
         or lower(coalesce(r.country,'')) like '%srb%'
         or coalesce(r.country,'')=''
       ))
     )
     and exists (
       select 1
       from public.menu_items m
       where m.restaurant_id=r.id
         and m.is_active
         and private.trend_seed_matches(c.seed_query,m.name,m.category,r.cuisine_type)
     )
    where c.status='pending'
    group by c.id
  ), scored_base as (
    select
      c.id,
      coalesce(cm.matched_restaurants,0) as matched_restaurants,
      coalesce(l.sample_count,0)::integer as owner_learning_samples,
      coalesce(l.preference_score,0)::integer as owner_learning_score,
      least(100,greatest(0,
        round(
          c.relevance_score*0.65
          + case when c.trend_type='rising' then 12 else 5 end
          + least(13,ln(greatest(c.extracted_value,0)+1)*1.6)
          + least(10,coalesce(cm.matched_restaurants,0)*3)
          + case when coalesce(l.sample_count,0)>=2 then coalesce(l.preference_score,0)*0.8 else 0 end
        )
      ))::integer as confidence,
      c.trend_type,c.relevance_score,c.extracted_value,c.last_seen_at
    from private.discovery_candidates c
    left join candidate_match cm on cm.id=c.id
    left join private.discovery_review_learning l on l.seed_query=lower(trim(c.seed_query))
    where c.status='pending'
  ), scored as (
    select
      id,matched_restaurants,owner_learning_samples,owner_learning_score,confidence,
      case
        when owner_learning_samples>=4 and owner_learning_score<=-7 then 'skip'
        when trend_type='rising'
          and relevance_score>=75
          and extracted_value>=300
          and matched_restaurants>=1
          and last_seen_at>=now()-interval '3 days'
          and not(owner_learning_samples>=3 and owner_learning_score<=-5)
        then 'approve'
        when owner_learning_samples>=4 and owner_learning_score>=7
          and trend_type='rising'
          and relevance_score>=70
          and extracted_value>=200
          and matched_restaurants>=1
          and last_seen_at>=now()-interval '3 days'
        then 'approve'
        when relevance_score>=55
          and matched_restaurants>=1
          and last_seen_at>=now()-interval '7 days'
          and not(owner_learning_samples>=4 and owner_learning_score<=-7)
        then 'review'
        else 'skip'
      end as recommendation,
      case
        when owner_learning_samples>=4 and owner_learning_score<=-7 then
          'OWNER istorija za ovaj seed je dosledno negativna; kandidat ostaje za ručnu proveru/preskakanje.'
        when owner_learning_samples>=4 and owner_learning_score>=7
          and trend_type='rising' and relevance_score>=70 and extracted_value>=200
          and matched_restaurants>=1 and last_seen_at>=now()-interval '3 days' then
          'Jak rising signal, a prethodne OWNER odluke za ovaj seed dodatno podižu poverenje.'
        when matched_restaurants=0 then 'Nema aktivnog restorana čijem meniju ili kuhinji ovaj seed trenutno odgovara.'
        when last_seen_at<now()-interval '7 days' then 'Signal je prestar za automatsku preporuku.'
        when relevance_score<55 then 'Relevantnost je preniska za preporuku.'
        when trend_type='rising' and relevance_score>=75 and extracted_value>=300 then
          'Jak rising signal sa visokom relevantnošću i stvarnim poklapanjem sa ponudom.'
        else 'Signal odgovara ponudi, ali traži OWNER proveru pre odobravanja.'
      end as review_reason
    from scored_base
  ), updated as (
    update private.discovery_candidates c
    set metadata = coalesce(c.metadata,'{}'::jsonb) || jsonb_build_object(
      'pre_review',jsonb_build_object(
        'recommendation',s.recommendation,
        'confidence',s.confidence,
        'matched_restaurants',s.matched_restaurants,
        'reason',s.review_reason,
        'owner_learning_score',s.owner_learning_score,
        'owner_learning_samples',s.owner_learning_samples,
        'owner_learning_applied',(s.owner_learning_samples>=2),
        'evaluated_at',now()
      )
    )
    from scored s
    where c.id=s.id
    returning s.recommendation
  )
  select
    count(*)::integer,
    count(*) filter (where recommendation='approve')::integer,
    count(*) filter (where recommendation='review')::integer,
    count(*) filter (where recommendation='skip')::integer
  into v_evaluated,v_approve,v_review,v_skip
  from updated;

  return jsonb_build_object(
    'ok',true,
    'evaluated',coalesce(v_evaluated,0),
    'approve_recommended',coalesce(v_approve,0),
    'review_recommended',coalesce(v_review,0),
    'skip_recommended',coalesce(v_skip,0),
    'finished_at',now()
  );
end;
$function$;

create or replace function private.admin_set_discovery_candidate_status(p_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(trim(coalesce(p_status,'')));
  v_query text;
  v_seed_query text;
  v_pre_review jsonb := '{}'::jsonb;
  v_recommendation text;
  v_alignment text;
  v_pipeline jsonb := jsonb_build_object('triggered',false);
  v_opportunities jsonb;
  v_repeat jsonb;
  v_notifications jsonb;
  v_learning jsonb;
  v_learning_snapshot jsonb:='{}'::jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_status not in ('pending','approved','rejected') then raise exception 'Invalid candidate status'; end if;

  update private.discovery_candidates
  set status=v_status,
      decided_at=case when v_status='pending' then null else now() end,
      decided_by=case when v_status='pending' then null else auth.uid() end
  where id=p_id
  returning query,seed_query,coalesce(metadata->'pre_review','{}'::jsonb)
  into v_query,v_seed_query,v_pre_review;

  if not found then raise exception 'Discovery candidate not found'; end if;

  v_recommendation:=coalesce(v_pre_review->>'recommendation','');
  v_alignment:=case
    when v_status='pending' then 'reset'
    when v_recommendation='' then 'manual_no_pre_review'
    when v_status='approved' and v_recommendation='approve' then 'aligned'
    when v_status='rejected' and v_recommendation='skip' then 'aligned'
    when v_recommendation='review' then 'manual_review_decision'
    else 'overrode_pre_review'
  end;

  v_learning:=private.refresh_discovery_review_learning();
  select jsonb_build_object(
    'seed_query',seed_query,
    'samples',sample_count,
    'approved',approved_count,
    'rejected',rejected_count,
    'preference_score',preference_score
  )
  into v_learning_snapshot
  from private.discovery_review_learning
  where seed_query=lower(trim(v_seed_query));

  if v_status='approved' then
    begin
      v_opportunities:=private.refresh_trend_content_opportunities(null);
      v_repeat:=private.apply_trend_repeat_penalties(null);
      v_notifications:=private.notify_high_trend_opportunities();
      v_pipeline:=jsonb_build_object(
        'triggered',true,'ok',true,
        'opportunities',coalesce(v_opportunities,'{}'::jsonb),
        'repeat_penalties',coalesce(v_repeat,'{}'::jsonb),
        'notifications',coalesce(v_notifications,'{}'::jsonb)
      );
    exception when others then
      v_pipeline:=jsonb_build_object('triggered',true,'ok',false,'error',sqlerrm);
    end;
  end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    case v_status
      when 'approved' then 'discovery_candidate_approved'
      when 'rejected' then 'discovery_candidate_rejected'
      else 'discovery_candidate_reset'
    end,
    'discovery_candidate',
    p_id,
    jsonb_build_object(
      'query',v_query,
      'seed_query',v_seed_query,
      'status',v_status,
      'pre_review',v_pre_review,
      'decision_alignment',v_alignment,
      'owner_learning',coalesce(v_learning_snapshot,'{}'::jsonb),
      'learning_refresh',coalesce(v_learning,'{}'::jsonb),
      'pipeline_refresh',v_pipeline
    )
  );

  return true;
end;
$function$;

create or replace function private.admin_discovery_review_learning_feed(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_rows jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  perform private.refresh_discovery_review_learning();
  select coalesce(jsonb_agg(to_jsonb(x) order by abs(x.preference_score) desc,x.sample_count desc,x.seed_query),'[]'::jsonb)
  into v_rows
  from (
    select seed_query,sample_count,approved_count,rejected_count,preference_score,last_decision_at,refreshed_at
    from private.discovery_review_learning
    order by abs(preference_score) desc,sample_count desc,seed_query
    limit greatest(1,least(coalesce(p_limit,20),100))
  ) x;
  return v_rows;
end;
$function$;

revoke all on function private.admin_discovery_review_learning_feed(integer) from public,anon;
grant execute on function private.admin_discovery_review_learning_feed(integer) to authenticated;

create or replace function public.admin_discovery_review_learning_feed(p_limit integer default 20)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_discovery_review_learning_feed(p_limit);
$function$;

revoke all on function public.admin_discovery_review_learning_feed(integer) from public,anon;
grant execute on function public.admin_discovery_review_learning_feed(integer) to authenticated;
