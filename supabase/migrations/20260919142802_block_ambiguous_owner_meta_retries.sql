create or replace function private.admin_queue_meta_retry(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_job public.social_publish_jobs%rowtype;
  v_connection public.social_connections%rowtype;
  v_manual_review boolean:=false;
  v_ack text;
  v_manual_retries integer:=0;
  v_result jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  select * into v_job from public.social_publish_jobs where id=p_job_id for update;
  if not found then raise exception 'Publish job not found'; end if;
  if v_job.status<>'failed' then raise exception 'Only failed jobs can be retried'; end if;
  if nullif(v_job.result->'incident'->>'dismissed_at','') is not null then raise exception 'Incident is dismissed'; end if;
  if nullif(v_job.provider_media_id,'') is not null then raise exception 'Provider media already exists; verify the Meta post before retry'; end if;
  if coalesce(v_job.attempt_count,0)>=3 then raise exception 'Publish retry limit reached'; end if;
  select * into v_connection from public.social_connections where id=v_job.connection_id;
  if not found or v_connection.status<>'connected' then raise exception 'Meta connection is not connected'; end if;
  if v_connection.token_expires_at is not null and v_connection.token_expires_at<=now() then raise exception 'Meta token is expired'; end if;
  v_manual_review:=coalesce((v_job.result->'recovery'->>'manual_review_required')::boolean,false);
  v_ack:=nullif(v_job.result->'recovery'->>'manual_review_acknowledged_at','');
  if v_manual_review and v_ack is null then raise exception 'Manual review must be acknowledged before retry'; end if;
  v_manual_retries:=coalesce((v_job.result->'incident'->>'manual_retry_count')::integer,0);
  if v_manual_retries>=2 then raise exception 'Manual retry limit reached'; end if;
  v_result:=coalesce(v_job.result,'{}'::jsonb)
    || jsonb_build_object('incident',coalesce(v_job.result->'incident','{}'::jsonb)
      || jsonb_build_object('manual_retry_count',v_manual_retries+1,'manual_retry_requested_at',now(),'manual_retry_requested_by',auth.uid()));
  update public.social_publish_jobs
  set status='queued',publish_at=now(),error_message=null,result=v_result,updated_at=now()
  where id=p_job_id;
  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'meta_publish_manual_retry_queued','social_publish_job',p_job_id::text,
    jsonb_build_object('restaurant_id',v_job.restaurant_id,'platform',v_job.platform,'attempt_count_before',v_job.attempt_count,'manual_retry_count',v_manual_retries+1,'manual_review_required',v_manual_review));
  return jsonb_build_object('ok',true,'job_id',p_job_id,'status','queued','publish_at',now(),'manual_retry_count',v_manual_retries+1);
end;
$function$;

create or replace function private.admin_incident_center(p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_jobs jsonb;
  v_connections jsonb;
  v_discovery jsonb;
  v_summary jsonb;
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.manual_review_required desc,x.updated_at desc),'[]'::jsonb)
  into v_jobs
  from (
    select j.id,j.restaurant_id,r.name as restaurant_name,j.post_id,coalesce(p.title,'Objava') as post_title,
      j.connection_id,j.platform,j.status,j.attempt_count,j.provider_media_id,j.error_message,j.updated_at,j.created_at,
      coalesce((j.result->'recovery'->>'manual_review_required')::boolean,false) as manual_review_required,
      (j.result->'recovery'->>'manual_review_acknowledged_at') as manual_review_acknowledged_at,
      coalesce((j.result->'incident'->>'manual_retry_count')::integer,0) as manual_retry_count,
      sc.status as connection_status,sc.token_expires_at,
      case
        when nullif(j.provider_media_id,'') is not null then false
        when coalesce(j.attempt_count,0)>=3 then false
        when coalesce((j.result->'incident'->>'manual_retry_count')::integer,0)>=2 then false
        when sc.status<>'connected' then false
        when sc.token_expires_at is not null and sc.token_expires_at<=now() then false
        when coalesce((j.result->'recovery'->>'manual_review_required')::boolean,false)
          and nullif(j.result->'recovery'->>'manual_review_acknowledged_at','') is null then false
        else true
      end as can_retry,
      case
        when nullif(j.provider_media_id,'') is not null then 'provider_media_exists'
        when coalesce(j.attempt_count,0)>=3 then 'attempt_limit'
        when coalesce((j.result->'incident'->>'manual_retry_count')::integer,0)>=2 then 'manual_retry_limit'
        when sc.status<>'connected' then 'connection_not_connected'
        when sc.token_expires_at is not null and sc.token_expires_at<=now() then 'token_expired'
        when coalesce((j.result->'recovery'->>'manual_review_required')::boolean,false)
          and nullif(j.result->'recovery'->>'manual_review_acknowledged_at','') is null then 'manual_review_not_acknowledged'
        else null
      end as retry_block_reason
    from public.social_publish_jobs j
    join public.restaurants r on r.id=j.restaurant_id
    left join public.posts p on p.id=j.post_id
    left join public.social_connections sc on sc.id=j.connection_id
    where j.status='failed' and nullif(j.result->'incident'->>'dismissed_at','') is null
    order by coalesce((j.result->'recovery'->>'manual_review_required')::boolean,false) desc,j.updated_at desc
    limit v_limit
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.severity desc,x.updated_at desc),'[]'::jsonb)
  into v_connections
  from (
    select sc.id,sc.restaurant_id,r.name as restaurant_name,r.owner_id,sc.status,sc.page_name,sc.instagram_username,
      sc.token_expires_at,sc.last_verified_at,sc.updated_at,
      case when sc.status in ('expired','error') then 2
           when sc.status='connected' and sc.token_expires_at is not null and sc.token_expires_at<=now()+interval '7 days' then 1
           else 0 end as severity,
      case when sc.status='expired' then 'Meta token je istekao'
           when sc.status='error' then 'Meta verifikacija ima grešku'
           when sc.status='connected' and sc.token_expires_at is not null and sc.token_expires_at<=now()+interval '7 days' then 'Meta token uskoro ističe'
           else 'Meta konekcija traži proveru' end as reason
    from public.social_connections sc
    join public.restaurants r on r.id=sc.restaurant_id
    where sc.provider='meta'
      and (sc.status in ('expired','error') or (sc.status='connected' and sc.token_expires_at is not null and sc.token_expires_at<=now()+interval '7 days'))
    order by severity desc,sc.updated_at desc
    limit v_limit
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb)
  into v_discovery
  from (
    select d.id,d.source,d.mode,d.status,d.started_at,d.finished_at,d.error_message,coalesce(d.metadata->>'reason','') as reason,
      coalesce((d.metadata->>'api_calls')::integer,0)+coalesce((d.metadata->>'candidate_api_calls')::integer,0) as api_calls,
      coalesce((d.metadata->>'candidates_upserted')::integer,0) as candidates_upserted,
      coalesce((d.metadata->>'budget_exhausted')::boolean,false) as budget_exhausted
    from private.discovery_sync_runs d
    where d.source='serpapi_google_trends' and d.status<>'success' and d.started_at>=now()-interval '14 days'
    order by d.started_at desc
    limit v_limit
  ) x;
  v_summary:=jsonb_build_object(
    'meta_failed',(select count(*) from public.social_publish_jobs j where j.status='failed' and nullif(j.result->'incident'->>'dismissed_at','') is null),
    'meta_manual_review',(select count(*) from public.social_publish_jobs j where j.status='failed' and nullif(j.result->'incident'->>'dismissed_at','') is null and coalesce((j.result->'recovery'->>'manual_review_required')::boolean,false)),
    'meta_connection_issues',(select count(*) from public.social_connections sc where sc.provider='meta' and (sc.status in ('expired','error') or (sc.status='connected' and sc.token_expires_at is not null and sc.token_expires_at<=now()+interval '7 days'))),
    'discovery_issues',(select count(*) from private.discovery_sync_runs d where d.source='serpapi_google_trends' and d.status<>'success' and d.started_at>=now()-interval '14 days')
  );
  return jsonb_build_object('summary',v_summary,'meta_jobs',v_jobs,'connections',v_connections,'discovery',v_discovery,'generated_at',now());
end;
$function$;
