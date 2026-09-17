create or replace function private.admin_trend_auto_dry_run(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  return coalesce((
    with restaurant_base as (
      select r.id,r.owner_id,r.name,r.trend_autopilot_mode
      from public.restaurants r
      where r.trend_autopilot_mode <> 'off'
      order by r.name
      limit greatest(1,least(coalesce(p_limit,50),200))
    ), monthly_usage as (
      select r.owner_id,count(p.id)::integer as used
      from public.restaurants r
      left join public.posts p
        on p.restaurant_id=r.id
       and p.created_at>=date_trunc('month',now() at time zone 'utc') at time zone 'utc'
      group by r.owner_id
    ), resolved as (
      select
        r.*,
        c.id as opportunity_id,
        c.trend_query,
        c.seed_query,
        c.opportunity_score,
        c.effectiveness_score,
        c.effectiveness_samples,
        c.performance_boost,
        c.performance_samples,
        c.repeat_penalty,
        c.auto_guard as trend_guard,
        exists(
          select 1 from public.posts p
          where p.restaurant_id=r.id
            and p.created_at>=now()-interval '24 hours'
            and coalesce(p.generation_meta->>'generation_source','')='trend_autopilot_auto'
        ) as daily_guard,
        exists(
          select 1 from public.app_admins a
          where a.user_id=r.owner_id and a.role='superadmin'
        ) as is_admin,
        s.id as subscription_id,
        coalesce(s.custom_generation_limit,sp.monthly_generation_limit) as monthly_limit,
        coalesce(mu.used,0) as monthly_used
      from restaurant_base r
      left join lateral (
        select *
        from private.trend_auto_candidates(array[r.id]::uuid[],1)
        order by auto_rank
        limit 1
      ) c on true
      left join lateral (
        select cs.*
        from public.customer_subscriptions cs
        where cs.user_id=r.owner_id
          and cs.status in ('active','trialing')
          and cs.starts_at<=now()
          and (cs.expires_at is null or cs.expires_at>now())
        order by cs.created_at desc
        limit 1
      ) s on true
      left join public.sales_plans sp on sp.id=s.plan_id
      left join monthly_usage mu on mu.owner_id=r.owner_id
    ), decided as (
      select *,
        case
          when trend_autopilot_mode<>'auto' then 'suggest_only'
          when opportunity_id is null then 'no_opportunity'
          when trend_guard<>'eligible' then trend_guard
          when daily_guard then 'daily_guard'
          when not is_admin and subscription_id is null then 'no_active_plan'
          when not is_admin and monthly_limit is not null and monthly_used>=monthly_limit then 'quota_reached'
          else 'would_create'
        end as decision
      from resolved
    )
    select jsonb_agg(jsonb_build_object(
      'restaurant_id',id,
      'restaurant_name',name,
      'mode',trend_autopilot_mode,
      'decision',decision,
      'would_create',decision='would_create',
      'opportunity_id',opportunity_id,
      'trend_query',trend_query,
      'seed_query',seed_query,
      'opportunity_score',opportunity_score,
      'effectiveness_score',effectiveness_score,
      'effectiveness_samples',effectiveness_samples,
      'performance_boost',performance_boost,
      'performance_samples',performance_samples,
      'repeat_penalty',repeat_penalty,
      'monthly_used',monthly_used,
      'monthly_limit',monthly_limit,
      'daily_guard',daily_guard
    ) order by name)
    from decided
  ),'[]'::jsonb);
end;
$function$;

revoke all on function private.admin_trend_auto_dry_run(integer) from public,anon,authenticated;

create or replace function public.admin_trend_auto_dry_run(p_limit integer default 50)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_trend_auto_dry_run(p_limit);
$function$;

revoke all on function public.admin_trend_auto_dry_run(integer) from public,anon;
grant execute on function public.admin_trend_auto_dry_run(integer) to authenticated;
