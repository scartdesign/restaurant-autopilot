do $$
begin
  if exists(select 1 from cron.job where jobname='restaurant-autopilot-discovery-pre-review') then
    perform cron.unschedule('restaurant-autopilot-discovery-pre-review');
  end if;
  perform cron.schedule(
    'restaurant-autopilot-discovery-pre-review',
    '20 4 * * *',
    'select private.refresh_discovery_candidate_pre_review();'
  );
end $$;

create or replace function private.admin_trend_provider_readiness()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_provider_configured boolean := false;
  v_settings record;
  v_pending_candidates integer := 0;
  v_approved_candidates integer := 0;
  v_rejected_candidates integer := 0;
  v_pre_approve integer := 0;
  v_pre_review integer := 0;
  v_pre_skip integer := 0;
  v_pending_opportunities integer := 0;
  v_eligible_auto integer := 0;
  v_modes jsonb := '{}'::jsonb;
  v_status text;
  v_candidate_budget integer := 0;
  v_term_budget integer := 0;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select exists(
    select 1 from vault.secrets where name='restaurant_autopilot_serpapi'
  ) into v_provider_configured;

  select * into v_settings
  from private.discovery_engine_settings
  where id=1;

  v_candidate_budget:=least(
    coalesce(v_settings.candidate_seed_limit,0),
    coalesce(v_settings.per_sync_call_limit,0),
    greatest(1,ceil(coalesce(v_settings.per_sync_call_limit,0)*0.4)::integer)
  );
  v_term_budget:=greatest(0,coalesce(v_settings.per_sync_call_limit,0)-v_candidate_budget);

  select
    count(*) filter (where status='pending')::integer,
    count(*) filter (where status='approved')::integer,
    count(*) filter (where status='rejected')::integer,
    count(*) filter (where status='pending' and metadata#>>'{pre_review,recommendation}'='approve')::integer,
    count(*) filter (where status='pending' and metadata#>>'{pre_review,recommendation}'='review')::integer,
    count(*) filter (where status='pending' and metadata#>>'{pre_review,recommendation}'='skip')::integer
  into v_pending_candidates,v_approved_candidates,v_rejected_candidates,v_pre_approve,v_pre_review,v_pre_skip
  from private.discovery_candidates;

  select
    count(*) filter (where status='pending')::integer,
    count(*) filter (
      where status='pending'
        and trend_type='rising'
        and expires_at>now()
        and opportunity_score>=85
        and coalesce(repeat_penalty,0)<20
        and not (coalesce(effectiveness_samples,0)>=3 and coalesce(effectiveness_score,50)<=30)
        and not (coalesce(performance_samples,0)>=3 and coalesce(performance_boost,0)<=-4)
        and (snoozed_until is null or snoozed_until<=now())
    )::integer
  into v_pending_opportunities,v_eligible_auto
  from public.trend_content_opportunities;

  select coalesce(jsonb_object_agg(trend_autopilot_mode,cnt),'{}'::jsonb)
  into v_modes
  from (
    select trend_autopilot_mode,count(*)::integer cnt
    from public.restaurants
    group by trend_autopilot_mode
  ) m;

  v_status:=case
    when not coalesce(v_settings.provider_enabled,false) then 'provider_paused'
    when not v_provider_configured then 'provider_key_missing'
    when v_approved_candidates=0 and v_pending_candidates=0 then 'waiting_for_candidates'
    when v_approved_candidates=0 and v_pending_candidates>0 then 'candidates_need_review'
    when v_pending_opportunities=0 then 'waiting_for_opportunities'
    when v_eligible_auto=0 then 'opportunities_guarded'
    when coalesce((v_modes->>'auto')::integer,0)=0 then 'ready_suggest_only'
    else 'ready'
  end;

  return jsonb_build_object(
    'status',v_status,
    'provider_configured',v_provider_configured,
    'provider_enabled',coalesce(v_settings.provider_enabled,false),
    'manual_seeds',(select count(*)::integer from private.discovery_seed_terms where active),
    'auto_profile_seeds_enabled',coalesce(v_settings.auto_profile_seeds_enabled,false),
    'per_sync_call_limit',coalesce(v_settings.per_sync_call_limit,0),
    'candidate_seed_limit',coalesce(v_settings.candidate_seed_limit,0),
    'estimated_candidate_call_budget',v_candidate_budget,
    'estimated_term_call_budget',v_term_budget,
    'daily_call_limit',coalesce(v_settings.daily_call_limit,0),
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'estimated_monthly_call_ceiling',coalesce(v_settings.daily_call_limit,0)*30,
    'candidates',jsonb_build_object(
      'pending',v_pending_candidates,
      'approved',v_approved_candidates,
      'rejected',v_rejected_candidates,
      'pre_approve',v_pre_approve,
      'pre_review',v_pre_review,
      'pre_skip',v_pre_skip
    ),
    'opportunities',jsonb_build_object(
      'pending',v_pending_opportunities,
      'eligible_auto',v_eligible_auto
    ),
    'modes',v_modes,
    'generated_at',now()
  );
end;
$function$;

revoke all on function private.admin_trend_provider_readiness() from public,anon,authenticated;