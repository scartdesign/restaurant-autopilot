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

  v_auto_guard:=case
    when v.status<>'pending' then v.status
    when v.trend_type<>'rising' then 'not_rising'
    when v.expires_at<=now() then 'expired'
    when v.snoozed_until is not null and v.snoozed_until>now() then 'snoozed'
    when coalesce(v.effectiveness_samples,0)>=3 and coalesce(v.effectiveness_score,50)<=30 then 'low_local_effectiveness'
    when coalesce(v.performance_samples,0)>=3 and coalesce(v.performance_boost,0)<=-4 then 'local_performance_guard'
    when coalesce(v.repeat_penalty,0)>=20 then 'repeat_cooldown'
    when v.opportunity_score<85 then 'below_auto_threshold'
    else 'eligible'
  end;

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

revoke all on function private.trend_opportunity_explain(uuid) from public,anon,authenticated;
