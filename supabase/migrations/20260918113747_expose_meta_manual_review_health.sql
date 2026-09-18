
create or replace function private.admin_production_ops_health()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_discovery jsonb;
  v_meta jsonb;
  v_e2e jsonb;
  v_blocking jsonb;
  v_latest record;
  v_serpapi boolean:=false;
  v_discovery_enabled boolean:=false;
  v_meta_app boolean:=false;
  v_meta_secret boolean:=false;
  v_meta_cron boolean:=false;
  v_stuck_recovery_cron boolean:=false;
  v_discovery_cron boolean:=false;
  v_connected integer:=0;
  v_expired integer:=0;
  v_error integer:=0;
  v_queued integer:=0;
  v_retrying integer:=0;
  v_failed integer:=0;
  v_processing integer:=0;
  v_stuck integer:=0;
  v_manual_review integer:=0;
  v_maxed integer:=0;
  v_insights_failed integer:=0;
  v_last_published timestamptz;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select exists(select 1 from vault.secrets where name='restaurant_autopilot_serpapi') into v_serpapi;
  select coalesce(provider_enabled,false) from private.discovery_engine_settings where id=1 into v_discovery_enabled;
  select exists(select 1 from cron.job where jobname='restaurant-autopilot-discovery-external' and active) into v_discovery_cron;

  select status,started_at,finished_at,error_message,metadata
  into v_latest
  from private.discovery_sync_runs
  where source='serpapi_google_trends'
  order by started_at desc
  limit 1;

  v_discovery:=jsonb_build_object(
    'provider_configured',v_serpapi,
    'provider_enabled',v_discovery_enabled,
    'cron_active',v_discovery_cron,
    'latest_status',coalesce(v_latest.status,'never'),
    'latest_started_at',v_latest.started_at,
    'latest_finished_at',v_latest.finished_at,
    'latest_error',v_latest.error_message,
    'latest_reason',v_latest.metadata->>'reason',
    'latest_api_calls',coalesce((v_latest.metadata->>'api_calls')::integer,0)+coalesce((v_latest.metadata->>'candidate_api_calls')::integer,0),
    'latest_candidates',coalesce((v_latest.metadata->>'candidates_upserted')::integer,0),
    'recent_success',coalesce(v_latest.status='success' and v_latest.started_at>=now()-interval '36 hours',false)
  );

  select exists(select 1 from vault.secrets where name='restaurant_autopilot_meta_app_id') into v_meta_app;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_meta_app_secret') into v_meta_secret;
  select exists(select 1 from cron.job where jobname='restaurant-autopilot-meta-publish' and active) into v_meta_cron;
  select exists(select 1 from cron.job where jobname='restaurant-autopilot-meta-stuck-recovery' and active) into v_stuck_recovery_cron;

  select
    count(*) filter(where status='connected')::integer,
    count(*) filter(where status='expired')::integer,
    count(*) filter(where status='error')::integer
  into v_connected,v_expired,v_error
  from public.social_connections
  where provider='meta';

  select
    count(*) filter(where status='queued')::integer,
    count(*) filter(where status='queued' and attempt_count>0)::integer,
    count(*) filter(where status='failed')::integer,
    count(*) filter(where status='processing')::integer,
    count(*) filter(where status='processing' and updated_at<now()-interval '15 minutes')::integer,
    count(*) filter(where status='failed' and coalesce((result->'recovery'->>'manual_review_required')::boolean,false))::integer,
    count(*) filter(where status='failed' and attempt_count>=3)::integer,
    count(*) filter(where insights_error is not null)::integer,
    max(published_at)
  into v_queued,v_retrying,v_failed,v_processing,v_stuck,v_manual_review,v_maxed,v_insights_failed,v_last_published
  from public.social_publish_jobs;

  v_meta:=jsonb_build_object(
    'provider_configured',v_meta_app and v_meta_secret,
    'cron_active',v_meta_cron,
    'stuck_recovery_cron_active',v_stuck_recovery_cron,
    'connected',coalesce(v_connected,0),
    'expired_connections',coalesce(v_expired,0),
    'error_connections',coalesce(v_error,0),
    'queued',coalesce(v_queued,0),
    'retrying',coalesce(v_retrying,0),
    'failed',coalesce(v_failed,0),
    'processing',coalesce(v_processing,0),
    'stuck_processing',coalesce(v_stuck,0),
    'manual_review_required',coalesce(v_manual_review,0),
    'max_attempts_failed',coalesce(v_maxed,0),
    'insights_failed',coalesce(v_insights_failed,0),
    'last_published_at',v_last_published,
    'auto_retry_max_attempts',3,
    'auto_retry_backoff_minutes',jsonb_build_array(5,20),
    'stuck_after_minutes',15,
    'stuck_recovery_interval_minutes',10
  );

  select coalesce(jsonb_agg(step),'[]'::jsonb)
  into v_blocking
  from (
    values
      (case when not v_serpapi then 'Dodaj SerpApi ključ'::text else null end),
      (case when not v_discovery_enabled then 'Uključi Discovery provider'::text else null end),
      (case when not v_meta_app or not v_meta_secret then 'Podesi Meta App ID + Secret'::text else null end),
      (case when coalesce(v_connected,0)=0 then 'Poveži test Facebook/Instagram nalog'::text else null end),
      (case when coalesce(v_connected,0)>0 and v_last_published is null then 'Objavi jedan kontrolisani test post'::text else null end),
      (case when coalesce(v_manual_review,0)>0 then 'Proveri Meta jobove označene za manual review'::text else null end)
  ) as x(step)
  where step is not null;

  v_e2e:=jsonb_build_object(
    'serpapi_ready',v_serpapi and v_discovery_enabled and v_discovery_cron,
    'meta_provider_ready',v_meta_app and v_meta_secret and v_meta_cron and v_stuck_recovery_cron,
    'meta_connection_ready',coalesce(v_connected,0)>0,
    'meta_publish_e2e_done',v_last_published is not null,
    'meta_insights_e2e_done',exists(select 1 from public.social_publish_jobs where insights_synced_at is not null and insights_error is null),
    'blocking_steps',v_blocking
  );

  return jsonb_build_object('discovery',v_discovery,'meta',v_meta,'e2e',v_e2e,'generated_at',now());
end;
$function$;
