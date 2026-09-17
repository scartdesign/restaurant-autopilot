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
  ), scored as (
    select
      c.id,
      coalesce(cm.matched_restaurants,0) as matched_restaurants,
      case
        when c.trend_type='rising'
          and c.relevance_score>=75
          and c.extracted_value>=300
          and coalesce(cm.matched_restaurants,0)>=1
          and c.last_seen_at>=now()-interval '3 days'
        then 'approve'
        when c.relevance_score>=55
          and coalesce(cm.matched_restaurants,0)>=1
          and c.last_seen_at>=now()-interval '7 days'
        then 'review'
        else 'skip'
      end as recommendation,
      least(100,greatest(0,
        round(
          c.relevance_score*0.65
          + case when c.trend_type='rising' then 12 else 5 end
          + least(13,ln(greatest(c.extracted_value,0)+1)*1.6)
          + least(10,coalesce(cm.matched_restaurants,0)*3)
        )
      ))::integer as confidence,
      case
        when coalesce(cm.matched_restaurants,0)=0 then 'Nema aktivnog restorana čijem meniju ili kuhinji ovaj seed trenutno odgovara.'
        when c.last_seen_at<now()-interval '7 days' then 'Signal je prestar za automatsku preporuku.'
        when c.relevance_score<55 then 'Relevantnost je preniska za preporuku.'
        when c.trend_type='rising' and c.relevance_score>=75 and c.extracted_value>=300 then 'Jak rising signal sa visokom relevantnošću i stvarnim poklapanjem sa ponudom.'
        else 'Signal odgovara ponudi, ali traži OWNER proveru pre odobravanja.'
      end as review_reason
    from private.discovery_candidates c
    left join candidate_match cm on cm.id=c.id
    where c.status='pending'
  ), updated as (
    update private.discovery_candidates c
    set metadata = coalesce(c.metadata,'{}'::jsonb) || jsonb_build_object(
      'pre_review',jsonb_build_object(
        'recommendation',s.recommendation,
        'confidence',s.confidence,
        'matched_restaurants',s.matched_restaurants,
        'reason',s.review_reason,
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

revoke all on function private.refresh_discovery_candidate_pre_review() from public,anon,authenticated;
grant execute on function private.refresh_discovery_candidate_pre_review() to service_role;

create or replace function public.service_pre_review_discovery_candidates()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.refresh_discovery_candidate_pre_review();
$function$;

revoke all on function public.service_pre_review_discovery_candidates() from public,anon,authenticated;
grant execute on function public.service_pre_review_discovery_candidates() to service_role;