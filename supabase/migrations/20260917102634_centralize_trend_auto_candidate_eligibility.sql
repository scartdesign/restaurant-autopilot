create or replace function private.trend_auto_candidates(
  p_restaurant_ids uuid[],
  p_limit_per_restaurant integer default 3
)
returns table(
  id uuid,
  restaurant_id uuid,
  candidate_id uuid,
  menu_item_id uuid,
  trend_query text,
  seed_query text,
  trend_type text,
  trend_value text,
  trend_signal integer,
  relevance_score integer,
  opportunity_score integer,
  performance_boost integer,
  performance_samples integer,
  effectiveness_score integer,
  effectiveness_samples integer,
  freshness_penalty integer,
  repeat_penalty integer,
  last_seed_used_at timestamptz,
  recommended_pillar text,
  recommended_action text,
  reason text,
  expires_at timestamptz,
  auto_guard text,
  auto_rank bigint
)
language sql
stable
security definer
set search_path to ''
as $function$
  with ranked as (
    select
      o.*,
      case
        when o.status<>'pending' then o.status
        when o.trend_type<>'rising' then 'not_rising'
        when o.expires_at<=now() then 'expired'
        when o.snoozed_until is not null and o.snoozed_until>now() then 'snoozed'
        when coalesce(o.effectiveness_samples,0)>=3 and coalesce(o.effectiveness_score,50)<=30 then 'low_local_effectiveness'
        when coalesce(o.performance_samples,0)>=3 and coalesce(o.performance_boost,0)<=-4 then 'local_performance_guard'
        when coalesce(o.repeat_penalty,0)>=20 then 'repeat_cooldown'
        when o.opportunity_score<85 then 'below_auto_threshold'
        else 'eligible'
      end as auto_guard,
      row_number() over(
        partition by o.restaurant_id
        order by
          (case when o.opportunity_score>=85 then 1 else 0 end) desc,
          o.opportunity_score desc,
          coalesce(o.effectiveness_score,50) desc,
          coalesce(o.performance_samples,0) desc,
          o.updated_at desc
      ) as auto_rank
    from public.trend_content_opportunities o
    where o.restaurant_id=any(p_restaurant_ids)
      and o.status='pending'
      and o.trend_type='rising'
      and o.expires_at>now()
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

revoke all on function private.trend_auto_candidates(uuid[],integer) from public,anon,authenticated;
grant execute on function private.trend_auto_candidates(uuid[],integer) to service_role;

create or replace function public.service_trend_auto_candidates(
  p_restaurant_ids uuid[],
  p_limit_per_restaurant integer default 3
)
returns table(
  id uuid,
  restaurant_id uuid,
  candidate_id uuid,
  menu_item_id uuid,
  trend_query text,
  seed_query text,
  trend_type text,
  trend_value text,
  trend_signal integer,
  relevance_score integer,
  opportunity_score integer,
  performance_boost integer,
  performance_samples integer,
  effectiveness_score integer,
  effectiveness_samples integer,
  freshness_penalty integer,
  repeat_penalty integer,
  last_seed_used_at timestamptz,
  recommended_pillar text,
  recommended_action text,
  reason text,
  expires_at timestamptz,
  auto_guard text,
  auto_rank bigint
)
language sql
security invoker
set search_path to ''
as $function$
  select * from private.trend_auto_candidates(p_restaurant_ids,p_limit_per_restaurant);
$function$;

revoke all on function public.service_trend_auto_candidates(uuid[],integer) from public,anon,authenticated;
grant execute on function public.service_trend_auto_candidates(uuid[],integer) to service_role;