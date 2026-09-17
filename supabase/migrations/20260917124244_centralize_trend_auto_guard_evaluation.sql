create or replace function private.trend_auto_guard_values(
  p_status text,
  p_trend_type text,
  p_expires_at timestamptz,
  p_snoozed_until timestamptz,
  p_effectiveness_samples integer,
  p_effectiveness_score integer,
  p_performance_samples integer,
  p_performance_boost integer,
  p_repeat_penalty integer,
  p_opportunity_score integer
)
returns text
language sql
stable
security invoker
set search_path to ''
as $function$
  select case
    when coalesce(p_status,'')<>'pending' then coalesce(p_status,'unknown_status')
    when coalesce(p_trend_type,'')<>'rising' then 'not_rising'
    when p_expires_at is null or p_expires_at<=now() then 'expired'
    when p_snoozed_until is not null and p_snoozed_until>now() then 'snoozed'
    when coalesce(p_effectiveness_samples,0)>=3 and coalesce(p_effectiveness_score,50)<=30 then 'low_local_effectiveness'
    when coalesce(p_performance_samples,0)>=3 and coalesce(p_performance_boost,0)<=-4 then 'local_performance_guard'
    when coalesce(p_repeat_penalty,0)>=20 then 'repeat_cooldown'
    when coalesce(p_opportunity_score,0)<85 then 'below_auto_threshold'
    else 'eligible'
  end;
$function$;

revoke all on function private.trend_auto_guard_values(text,text,timestamptz,timestamptz,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function private.trend_auto_guard_values(text,text,timestamptz,timestamptz,integer,integer,integer,integer,integer,integer) to service_role;

create or replace function private.trend_auto_candidates(p_restaurant_ids uuid[], p_limit_per_restaurant integer default 3)
returns table(
  id uuid, restaurant_id uuid, candidate_id uuid, menu_item_id uuid, trend_query text, seed_query text,
  trend_type text, trend_value text, trend_signal integer, relevance_score integer, opportunity_score integer,
  performance_boost integer, performance_samples integer, effectiveness_score integer, effectiveness_samples integer,
  freshness_penalty integer, repeat_penalty integer, last_seed_used_at timestamptz, recommended_pillar text,
  recommended_action text, reason text, expires_at timestamptz, auto_guard text, auto_rank bigint
)
language sql
stable
security definer
set search_path to ''
as $function$
  with scored as (
    select
      o.*,
      private.trend_auto_guard_values(
        o.status,o.trend_type,o.expires_at,o.snoozed_until,
        o.effectiveness_samples,o.effectiveness_score,
        o.performance_samples,o.performance_boost,
        o.repeat_penalty,o.opportunity_score
      ) as auto_guard
    from public.trend_content_opportunities o
    where o.restaurant_id=any(p_restaurant_ids)
      and o.status='pending'
      and o.trend_type='rising'
      and o.expires_at>now()
  ), ranked as (
    select
      s.*,
      row_number() over(
        partition by s.restaurant_id
        order by
          (case when s.auto_guard='eligible' then 1 else 0 end) desc,
          s.opportunity_score desc,
          coalesce(s.effectiveness_score,50) desc,
          coalesce(s.performance_samples,0) desc,
          s.updated_at desc
      ) as auto_rank
    from scored s
  )
  select
    r.id,r.restaurant_id,r.candidate_id,r.menu_item_id,r.trend_query,r.seed_query,r.trend_type,
    r.trend_value,r.trend_signal,r.relevance_score,r.opportunity_score,r.performance_boost,r.performance_samples,
    r.effectiveness_score,r.effectiveness_samples,r.freshness_penalty,r.repeat_penalty,r.last_seed_used_at,
    r.recommended_pillar,r.recommended_action,r.reason,r.expires_at,r.auto_guard,r.auto_rank
  from ranked r
  where r.auto_rank<=greatest(1,least(coalesce(p_limit_per_restaurant,3),10))
  order by r.restaurant_id,r.auto_rank;
$function$;

create or replace function private.trend_opportunity_explain(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v record;
  v_pre_repeat integer;
  v_estimated_base integer;
  v_auto_guard text;
begin
  select o.*,r.owner_id
  into v
  from public.trend_content_opportunities o
  join public.restaurants r on r.id=o.restaurant_id
  where o.id=p_id;

  if v.id is null then raise exception 'Trend opportunity not found'; end if;
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if v.owner_id<>auth.uid() and not private.is_superadmin() then raise exception 'Forbidden'; end if;

  v_pre_repeat:=least(100,greatest(0,v.opportunity_score+coalesce(v.repeat_penalty,0)));
  v_estimated_base:=least(100,greatest(0,
    v_pre_repeat-coalesce(v.performance_boost,0)+coalesce(v.freshness_penalty,0)
  ));

  v_auto_guard:=private.trend_auto_guard_values(
    v.status,v.trend_type,v.expires_at,v.snoozed_until,
    v.effectiveness_samples,v.effectiveness_score,
    v.performance_samples,v.performance_boost,
    v.repeat_penalty,v.opportunity_score
  );

  return jsonb_build_object(
    'id',v.id,
    'trend_query',v.trend_query,
    'seed_query',v.seed_query,
    'final_score',v.opportunity_score,
    'estimated_base_score',v_estimated_base,
    'performance_boost',coalesce(v.performance_boost,0),
    'performance_samples',coalesce(v.performance_samples,0),
    'effectiveness_score',coalesce(v.effectiveness_score,50),
    'effectiveness_samples',coalesce(v.effectiveness_samples,0),
    'freshness_penalty',coalesce(v.freshness_penalty,0),
    'repeat_penalty',coalesce(v.repeat_penalty,0),
    'candidate_last_seen_at',v.candidate_last_seen_at,
    'last_seed_used_at',v.last_seed_used_at,
    'snoozed_until',v.snoozed_until,
    'auto_guard',v_auto_guard,
    'explanation',jsonb_build_array(
      jsonb_build_object('signal','base','value',v_estimated_base,'label','Trend + relevance + menu fit'),
      jsonb_build_object('signal','performance','value',coalesce(v.performance_boost,0),'label','Observed local performance association'),
      jsonb_build_object('signal','freshness','value',-coalesce(v.freshness_penalty,0),'label','Freshness adjustment'),
      jsonb_build_object('signal','repeat','value',-coalesce(v.repeat_penalty,0),'label','Repeat cooldown adjustment')
    )
  );
end;
$function$;

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
    'eligible_auto',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='eligible'),
    'repeat_cooldown',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='repeat_cooldown'),
    'low_effectiveness_guard',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='low_local_effectiveness'),
    'local_performance_guard',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='local_performance_guard'),
    'below_auto_threshold',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='below_auto_threshold'),
    'snoozed',count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='snoozed')
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

  select exists(select 1 from vault.secrets where name='restaurant_autopilot_serpapi') into v_provider_configured;
  select * into v_settings from private.discovery_engine_settings where id=1;

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
    count(*) filter (where private.trend_auto_guard_values(status,trend_type,expires_at,snoozed_until,effectiveness_samples,effectiveness_score,performance_samples,performance_boost,repeat_penalty,opportunity_score)='eligible')::integer
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
    'opportunities',jsonb_build_object('pending',v_pending_opportunities,'eligible_auto',v_eligible_auto),
    'modes',v_modes,
    'generated_at',now()
  );
end;
$function$;

revoke all on function private.admin_trend_provider_readiness() from public,anon,authenticated;
