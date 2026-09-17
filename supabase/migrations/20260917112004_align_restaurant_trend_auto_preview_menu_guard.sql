create or replace function private.restaurant_trend_auto_preview(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant record;
  v_candidate record;
  v_daily_guard boolean := false;
  v_has_active_menu_item boolean := false;
  v_is_admin boolean := false;
  v_subscription record;
  v_monthly_limit integer;
  v_monthly_used integer := 0;
  v_decision text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  select r.id,r.owner_id,r.name,r.trend_autopilot_mode
  into v_restaurant
  from public.restaurants r
  where r.id=p_restaurant_id;

  if v_restaurant.id is null then raise exception 'Restaurant not found'; end if;
  if v_restaurant.owner_id<>auth.uid() and not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select * into v_candidate
  from private.trend_auto_candidates(array[p_restaurant_id]::uuid[],1)
  order by auto_rank
  limit 1;

  select exists(
    select 1 from public.posts p
    where p.restaurant_id=p_restaurant_id
      and p.created_at>=now()-interval '24 hours'
      and coalesce(p.generation_meta->>'generation_source','')='trend_autopilot_auto'
  ) into v_daily_guard;

  select exists(
    select 1 from public.menu_items m
    where m.restaurant_id=p_restaurant_id and m.is_active
  ) into v_has_active_menu_item;

  select exists(
    select 1 from public.app_admins a
    where a.user_id=v_restaurant.owner_id and a.role='superadmin'
  ) into v_is_admin;

  if not v_is_admin then
    select cs.* into v_subscription
    from public.customer_subscriptions cs
    where cs.user_id=v_restaurant.owner_id
      and cs.status in ('active','trialing')
      and cs.starts_at<=now()
      and (cs.expires_at is null or cs.expires_at>now())
    order by cs.created_at desc
    limit 1;

    if v_subscription.id is not null then
      select coalesce(v_subscription.custom_generation_limit,sp.monthly_generation_limit)
      into v_monthly_limit
      from public.sales_plans sp
      where sp.id=v_subscription.plan_id;
    end if;
  end if;

  select count(p.id)::integer into v_monthly_used
  from public.restaurants r
  join public.posts p on p.restaurant_id=r.id
  where r.owner_id=v_restaurant.owner_id
    and p.created_at>=date_trunc('month',now() at time zone 'utc') at time zone 'utc';

  v_decision:=case
    when v_restaurant.trend_autopilot_mode='off' then 'off'
    when v_restaurant.trend_autopilot_mode='suggest' then 'suggest_only'
    when v_candidate.id is null then 'no_opportunity'
    when v_candidate.auto_guard<>'eligible' then v_candidate.auto_guard
    when v_daily_guard then 'daily_guard'
    when not v_is_admin and v_subscription.id is null then 'no_active_plan'
    when not v_is_admin and v_monthly_limit is not null and v_monthly_used>=v_monthly_limit then 'quota_reached'
    when not v_has_active_menu_item then 'no_menu_item'
    else 'would_create'
  end;

  return jsonb_build_object(
    'restaurant_id',v_restaurant.id,
    'restaurant_name',v_restaurant.name,
    'mode',v_restaurant.trend_autopilot_mode,
    'decision',v_decision,
    'would_create',v_decision='would_create',
    'daily_guard',v_daily_guard,
    'has_active_menu_item',v_has_active_menu_item,
    'monthly_used',v_monthly_used,
    'monthly_limit',v_monthly_limit,
    'opportunity',case when v_candidate.id is null then null else jsonb_build_object(
      'id',v_candidate.id,
      'trend_query',v_candidate.trend_query,
      'seed_query',v_candidate.seed_query,
      'score',v_candidate.opportunity_score,
      'auto_guard',v_candidate.auto_guard,
      'effectiveness_score',v_candidate.effectiveness_score,
      'effectiveness_samples',v_candidate.effectiveness_samples,
      'performance_boost',v_candidate.performance_boost,
      'performance_samples',v_candidate.performance_samples,
      'repeat_penalty',v_candidate.repeat_penalty,
      'expires_at',v_candidate.expires_at
    ) end,
    'checked_at',now()
  );
end;
$function$;

revoke all on function private.restaurant_trend_auto_preview(uuid) from public,anon;
