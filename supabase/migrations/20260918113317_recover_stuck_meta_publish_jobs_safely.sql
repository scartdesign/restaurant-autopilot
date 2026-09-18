
create or replace function private.recover_stuck_meta_publish_jobs()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer:=0;
begin
  with stuck as (
    select j.id,j.restaurant_id,j.post_id,j.connection_id,j.platform,j.attempt_count,j.updated_at,c.user_id
    from public.social_publish_jobs j
    left join public.social_connections c on c.id=j.connection_id
    where j.status='processing'
      and j.updated_at<now()-interval '15 minutes'
    for update of j skip locked
  ), recovered as (
    update public.social_publish_jobs j
    set status='failed',
        error_message='Publishing worker je prekinut tokom slanja. Automatski retry je namerno zaustavljen zbog rizika od duple objave; proveri Meta nalog pre ručnog retry-a.',
        result=coalesce(j.result,'{}'::jsonb)||jsonb_build_object(
          'recovery',jsonb_build_object(
            'reason','stuck_processing',
            'recovered_at',now(),
            'manual_review_required',true
          )
        ),
        updated_at=now()
    from stuck s
    where j.id=s.id
    returning j.id,j.restaurant_id,j.post_id,j.connection_id,j.platform,j.attempt_count,s.user_id
  ), activity as (
    insert into public.autopilot_activity(
      restaurant_id,user_id,event_type,title,summary,metadata
    )
    select
      r.restaurant_id,
      r.user_id,
      'publish_stuck_recovered',
      'Meta publishing zahteva ručnu proveru',
      case when r.platform='instagram' then 'Instagram' else 'Facebook' end||
        ' job je ostao zaglavljen u processing stanju. Nije automatski ponovljen zbog rizika od duple objave.',
      jsonb_build_object(
        'job_id',r.id,
        'post_id',r.post_id,
        'platform',r.platform,
        'attempt_count',r.attempt_count,
        'manual_review_required',true
      )
    from recovered r
    returning id
  )
  select count(*)::integer into v_count from recovered;

  return jsonb_build_object('ok',true,'recovered',v_count,'manual_review_required',v_count,'finished_at',now());
end;
$function$;

revoke all on function private.recover_stuck_meta_publish_jobs() from public,anon,authenticated;
grant execute on function private.recover_stuck_meta_publish_jobs() to service_role;

do $do$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='restaurant-autopilot-meta-stuck-recovery' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'restaurant-autopilot-meta-stuck-recovery',
    '*/10 * * * *',
    $cron$select private.recover_stuck_meta_publish_jobs();$cron$
  );
end;
$do$;
