create or replace function private.cleanup_trend_intelligence_memory()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_deleted integer := 0;
begin
  delete from private.trend_seed_effectiveness
  where last_measured_at is null
     or last_measured_at < now()-interval '210 days';
  get diagnostics v_deleted = row_count;

  update public.trend_content_opportunities
  set effectiveness_score=50,
      effectiveness_samples=0,
      updated_at=now()
  where effectiveness_samples>0
    and not exists (
      select 1
      from private.trend_seed_effectiveness e
      where e.restaurant_id=public.trend_content_opportunities.restaurant_id
        and e.seed_query=lower(trim(coalesce(public.trend_content_opportunities.seed_query,'')))
        and e.last_measured_at>=now()-interval '180 days'
    );

  return jsonb_build_object('ok',true,'deleted_effectiveness_rows',v_deleted,'finished_at',now());
end;
$function$;

revoke all on function private.cleanup_trend_intelligence_memory() from public,anon,authenticated;
grant execute on function private.cleanup_trend_intelligence_memory() to service_role;

create or replace function private.admin_trend_intelligence_health()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_effectiveness jsonb;
  v_opportunities jsonb;
  v_sources jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select jsonb_build_object(
    'learned_seeds',count(*),
    'restaurants',count(distinct restaurant_id),
    'strong_positive',count(*) filter (where sample_count>=3 and effectiveness_score>=70),
    'strong_negative',count(*) filter (where sample_count>=3 and effectiveness_score<=30),
    'high_confidence',count(*) filter (where sample_count>=5),
    'fresh_30d',count(*) filter (where last_measured_at>=now()-interval '30 days'),
    'stale_180d',count(*) filter (where last_measured_at<now()-interval '180 days')
  ) into v_effectiveness
  from private.trend_seed_effectiveness;

  select jsonb_build_object(
    'pending',count(*) filter (where status='pending'),
    'eligible_auto',count(*) filter (
      where status='pending' and trend_type='rising' and expires_at>now()
        and opportunity_score>=85
        and coalesce(repeat_penalty,0)<20
        and not (coalesce(effectiveness_samples,0)>=3 and coalesce(effectiveness_score,50)<=30)
        and not (coalesce(performance_samples,0)>=3 and coalesce(performance_boost,0)<=-4)
        and (snoozed_until is null or snoozed_until<=now())
    ),
    'repeat_cooldown',count(*) filter (where status='pending' and coalesce(repeat_penalty,0)>=20),
    'low_effectiveness_guard',count(*) filter (where status='pending' and effectiveness_samples>=3 and effectiveness_score<=30),
    'local_performance_guard',count(*) filter (where status='pending' and performance_samples>=3 and performance_boost<=-4),
    'below_auto_threshold',count(*) filter (where status='pending' and trend_type='rising' and opportunity_score<85),
    'snoozed',count(*) filter (where status='snoozed')
  ) into v_opportunities
  from public.trend_content_opportunities;

  select jsonb_build_object(
    'manual_seeds',(select count(*) from private.discovery_seed_terms where active),
    'auto_profile_enabled',(select auto_profile_seeds_enabled from private.discovery_engine_settings where id=1),
    'provider_enabled',(select provider_enabled from private.discovery_engine_settings where id=1),
    'daily_calls_used',private.discovery_daily_api_calls_used()
  ) into v_sources;

  return jsonb_build_object(
    'effectiveness',coalesce(v_effectiveness,'{}'::jsonb),
    'opportunities',coalesce(v_opportunities,'{}'::jsonb),
    'sources',coalesce(v_sources,'{}'::jsonb),
    'generated_at',now()
  );
end;
$function$;

revoke all on function private.admin_trend_intelligence_health() from public,anon,authenticated;

create or replace function public.admin_trend_intelligence_health()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_trend_intelligence_health();
$function$;

revoke all on function public.admin_trend_intelligence_health() from public,anon;
grant execute on function public.admin_trend_intelligence_health() to authenticated;

select cron.unschedule('restaurant-autopilot-trend-opportunities');
select cron.schedule(
  'restaurant-autopilot-trend-opportunities',
  '25 */6 * * *',
  $cron$
    select private.cleanup_trend_intelligence_memory();
    select private.refresh_trend_seed_effectiveness(null);
    select private.refresh_trend_content_opportunities(null);
    select private.apply_trend_repeat_penalties(null);
  $cron$
);