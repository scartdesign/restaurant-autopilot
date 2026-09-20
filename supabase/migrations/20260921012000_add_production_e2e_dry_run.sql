create or replace function private.admin_production_e2e_dry_run()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_checks jsonb:='[]'::jsonb;
  v_blockers jsonb:='[]'::jsonb;
  v_warnings jsonb:='[]'::jsonb;
  v_serpapi boolean:=false;
  v_discovery_enabled boolean:=false;
  v_discovery_cron boolean:=false;
  v_weekly_cron boolean:=false;
  v_weekly_function boolean:=false;
  v_meta_app boolean:=false;
  v_meta_secret boolean:=false;
  v_meta_publish_cron boolean:=false;
  v_meta_publish_contract boolean:=false;
  v_meta_stuck_cron boolean:=false;
  v_meta_stuck_function boolean:=false;
  v_meta_insights_cron boolean:=false;
  v_meta_insights_contract boolean:=false;
  v_retry_guard boolean:=false;
  v_connected integer:=0;
  v_manual_review integer:=0;
  v_provider_media_failed integer:=0;
  v_last_published timestamptz;
  v_last_insights timestamptz;
  v_retry_def text;
  v_stuck_def text;
  v_weekly_def text;
  v_publish_command text;
  v_insights_command text;
begin
  if not private.is_superadmin() then
    raise exception 'Forbidden';
  end if;

  select exists(
    select 1 from vault.secrets
    where name='restaurant_autopilot_serpapi'
  ) into v_serpapi;

  select coalesce(provider_enabled,false)
  into v_discovery_enabled
  from private.discovery_engine_settings
  where id=1;

  select exists(
    select 1 from cron.job
    where jobname='restaurant-autopilot-discovery-external' and active
  ) into v_discovery_cron;

  select exists(
    select 1 from cron.job
    where jobname='restaurant-autopilot-weekly-background' and active
  ) into v_weekly_cron;

  select pg_get_functiondef(to_regprocedure('private.background_weekly_autopilot(boolean,boolean)'))
  into v_weekly_def;
  v_weekly_function:=coalesce(v_weekly_def,'') like '%p_dry_run boolean%';

  select exists(
    select 1 from vault.secrets
    where name='restaurant_autopilot_meta_app_id'
  ) into v_meta_app;

  select exists(
    select 1 from vault.secrets
    where name='restaurant_autopilot_meta_app_secret'
  ) into v_meta_secret;

  select active,command
  into v_meta_publish_cron,v_publish_command
  from cron.job
  where jobname='restaurant-autopilot-meta-publish'
  limit 1;
  v_meta_publish_cron:=coalesce(v_meta_publish_cron,false);
  v_meta_publish_contract:=v_meta_publish_cron
    and coalesce(v_publish_command,'') like '%/functions/v1/meta-publisher%'
    and coalesce(v_publish_command,'') like '%process%';

  select exists(
    select 1 from cron.job
    where jobname='restaurant-autopilot-meta-stuck-recovery' and active
  ) into v_meta_stuck_cron;

  select pg_get_functiondef(to_regprocedure('private.recover_stuck_meta_publish_jobs()'))
  into v_stuck_def;
  v_meta_stuck_function:=coalesce(v_stuck_def,'') like '%manual_review_required%'
    and coalesce(v_stuck_def,'') like '%status=''failed''%';

  select active,command
  into v_meta_insights_cron,v_insights_command
  from cron.job
  where jobname='restaurant-autopilot-meta-insights'
  limit 1;
  v_meta_insights_cron:=coalesce(v_meta_insights_cron,false);
  v_meta_insights_contract:=v_meta_insights_cron
    and coalesce(v_insights_command,'') like '%/functions/v1/meta-publisher%'
    and coalesce(v_insights_command,'') like '%process_insights%';

  select pg_get_functiondef(to_regprocedure('private.admin_queue_meta_retry(uuid)'))
  into v_retry_def;
  v_retry_guard:=coalesce(v_retry_def,'') like '%Provider media already exists%'
    and coalesce(v_retry_def,'') like '%Publish retry limit reached%'
    and coalesce(v_retry_def,'') like '%Manual review must be acknowledged before retry%'
    and coalesce(v_retry_def,'') like '%Manual retry limit reached%';

  select
    count(*) filter(where status='connected')::integer
  into v_connected
  from public.social_connections
  where provider='meta';

  select
    count(*) filter(
      where status='failed'
        and coalesce((result->'recovery'->>'manual_review_required')::boolean,false)
        and nullif(result->'incident'->>'dismissed_at','') is null
    )::integer,
    count(*) filter(
      where status='failed'
        and nullif(provider_media_id,'') is not null
        and nullif(result->'incident'->>'dismissed_at','') is null
    )::integer,
    max(published_at),
    max(insights_synced_at)
  into v_manual_review,v_provider_media_failed,v_last_published,v_last_insights
  from public.social_publish_jobs;

  v_checks:=v_checks||jsonb_build_array(
    jsonb_build_object(
      'id','discovery-provider',
      'label','Discovery provider',
      'status',case when v_serpapi and v_discovery_enabled then 'pass' when v_serpapi then 'warn' else 'blocked' end,
      'detail',case when not v_serpapi then 'SerpApi ključ nije podešen'
                    when not v_discovery_enabled then 'Ključ postoji, ali provider nije uključen'
                    else 'Provider i secret su spremni' end
    ),
    jsonb_build_object(
      'id','discovery-cron',
      'label','Discovery cron',
      'status',case when v_discovery_cron then 'pass' else 'blocked' end,
      'detail',case when v_discovery_cron then 'External discovery cron je aktivan' else 'External discovery cron nije aktivan' end
    ),
    jsonb_build_object(
      'id','weekly-autopilot',
      'label','AUTO WEEK background',
      'status',case when v_weekly_cron and v_weekly_function then 'pass' else 'blocked' end,
      'detail',case when v_weekly_cron and v_weekly_function then 'Background generator + dry-run contract su prisutni' else 'Nedostaje AUTO WEEK cron ili dry-run funkcija' end
    ),
    jsonb_build_object(
      'id','meta-provider',
      'label','Meta provider',
      'status',case when v_meta_app and v_meta_secret then 'pass' else 'blocked' end,
      'detail',case when v_meta_app and v_meta_secret then 'App ID i App Secret su prisutni u Vault-u' else 'Meta App ID / Secret nisu kompletni' end
    ),
    jsonb_build_object(
      'id','meta-publish-worker',
      'label','Meta publish worker',
      'status',case when v_meta_publish_contract then 'pass' else 'blocked' end,
      'detail',case when v_meta_publish_contract then 'Cron je aktivan i poziva meta-publisher worker' else 'Publish cron ili worker contract nisu spremni' end
    ),
    jsonb_build_object(
      'id','meta-stuck-recovery',
      'label','Stuck recovery',
      'status',case when v_meta_stuck_cron and v_meta_stuck_function then 'pass' else 'blocked' end,
      'detail',case when v_meta_stuck_cron and v_meta_stuck_function then 'Recovery cron prebacuje nejasne processing ishode u manual review' else 'Stuck recovery zaštita nije kompletna' end
    ),
    jsonb_build_object(
      'id','meta-insights',
      'label','Meta Insights worker',
      'status',case when v_meta_insights_contract then 'pass' else 'blocked' end,
      'detail',case when v_meta_insights_contract then 'Insights cron je aktivan i koristi isti server-side publisher' else 'Insights cron/contract nije spreman' end
    ),
    jsonb_build_object(
      'id','retry-safety',
      'label','Retry safety guard',
      'status',case when v_retry_guard then 'pass' else 'blocked' end,
      'detail',case when v_retry_guard then 'Blokirani su provider-media duplikati, max attempts i retry bez manual review potvrde' else 'Nedostaje jedan ili više server-side retry guardova' end
    ),
    jsonb_build_object(
      'id','meta-test-connection',
      'label','Meta test konekcija',
      'status',case when v_connected>0 then 'pass' else 'blocked' end,
      'detail',case when v_connected>0 then v_connected||' connected Meta konekcija' else 'Nema connected Meta test naloga' end
    ),
    jsonb_build_object(
      'id','incident-state',
      'label','Aktivni rizični incidenti',
      'status',case when v_manual_review=0 and v_provider_media_failed=0 then 'pass' else 'warn' end,
      'detail',v_manual_review||' manual review · '||v_provider_media_failed||' failed sa provider media ID'
    ),
    jsonb_build_object(
      'id','external-e2e-history',
      'label','Kontrolisani external E2E',
      'status',case when v_last_published is not null and v_last_insights is not null then 'pass' else 'warn' end,
      'detail',case
        when v_last_published is null then 'Nema istorije stvarne Meta objave — dry-run je namerno ništa nije objavio'
        when v_last_insights is null then 'Publish postoji, ali još nema uspešnog Insights sync-a'
        else 'Postoji publish + Insights E2E istorija'
      end
    )
  );

  if not v_serpapi then v_blockers:=v_blockers||jsonb_build_array('Dodaj SerpApi ključ'); end if;
  if not v_discovery_enabled then v_blockers:=v_blockers||jsonb_build_array('Uključi Discovery provider'); end if;
  if not v_discovery_cron then v_blockers:=v_blockers||jsonb_build_array('Aktiviraj Discovery cron'); end if;
  if not (v_weekly_cron and v_weekly_function) then v_blockers:=v_blockers||jsonb_build_array('Popravi AUTO WEEK background cron'); end if;
  if not (v_meta_app and v_meta_secret) then v_blockers:=v_blockers||jsonb_build_array('Podesi Meta App ID + Secret'); end if;
  if not v_meta_publish_contract then v_blockers:=v_blockers||jsonb_build_array('Popravi Meta publish worker cron'); end if;
  if not (v_meta_stuck_cron and v_meta_stuck_function) then v_blockers:=v_blockers||jsonb_build_array('Popravi stuck recovery guard'); end if;
  if not v_meta_insights_contract then v_blockers:=v_blockers||jsonb_build_array('Popravi Meta Insights cron'); end if;
  if not v_retry_guard then v_blockers:=v_blockers||jsonb_build_array('Vrati server-side Meta retry safety guardove'); end if;
  if v_connected=0 then v_blockers:=v_blockers||jsonb_build_array('Poveži kontrolisani Meta test nalog'); end if;
  if v_manual_review>0 then v_warnings:=v_warnings||jsonb_build_array(v_manual_review||' Meta jobova čeka manual review'); end if;
  if v_provider_media_failed>0 then v_warnings:=v_warnings||jsonb_build_array(v_provider_media_failed||' failed jobova već ima provider media ID i ne sme u slepi retry'); end if;
  if v_last_published is null then v_warnings:=v_warnings||jsonb_build_array('Pravi Meta publish E2E još nije izvršen'); end if;
  if v_last_insights is null then v_warnings:=v_warnings||jsonb_build_array('Pravi Meta Insights E2E još nije potvrđen'); end if;

  return jsonb_build_object(
    'ok',jsonb_array_length(v_blockers)=0,
    'mode','read_only',
    'external_calls',false,
    'publishes',false,
    'checks',v_checks,
    'blockers',v_blockers,
    'warnings',v_warnings,
    'ready_for_controlled_external_test',jsonb_array_length(v_blockers)=0,
    'generated_at',now()
  );
end;
$function$;

revoke all on function private.admin_production_e2e_dry_run() from public,anon,authenticated;
grant execute on function private.admin_production_e2e_dry_run() to authenticated;

create or replace function public.admin_production_e2e_dry_run()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_production_e2e_dry_run();
$function$;

revoke all on function public.admin_production_e2e_dry_run() from public,anon;
grant execute on function public.admin_production_e2e_dry_run() to authenticated;
