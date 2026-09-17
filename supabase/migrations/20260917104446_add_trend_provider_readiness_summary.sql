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
  v_pending_opportunities integer := 0;
  v_eligible_auto integer := 0;
  v_modes jsonb := '{}'::jsonb;
  v_status text;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select exists(
    select 1 from vault.secrets where name='restaurant_autopilot_serpapi'
  ) into v_provider_configured;

  select * into v_settings
  from private.discovery_engine_settings
  where id=1;

  select
    count(*) filter (where status='pending')::integer,
    count(*) filter (where status='approved')::integer,
    count(*) filter (where status='rejected')::integer
  into v_pending_candidates,v_approved_candidates,v_rejected_candidates
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
    'daily_call_limit',coalesce(v_settings.daily_call_limit,0),
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'estimated_monthly_call_ceiling',coalesce(v_settings.daily_call_limit,0)*30,
    'candidates',jsonb_build_object(
      'pending',v_pending_candidates,
      'approved',v_approved_candidates,
      'rejected',v_rejected_candidates
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

create or replace function public.admin_trend_provider_readiness()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_trend_provider_readiness();
$function$;

revoke all on function public.admin_trend_provider_readiness() from public,anon;
grant execute on function public.admin_trend_provider_readiness() to authenticated;
