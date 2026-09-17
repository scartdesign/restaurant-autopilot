create table if not exists private.trend_seed_effectiveness (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  seed_query text not null,
  sample_count integer not null default 0 check (sample_count >= 0),
  reach_sum bigint not null default 0 check (reach_sum >= 0),
  weighted_actions numeric not null default 0 check (weighted_actions >= 0),
  action_rate numeric not null default 0 check (action_rate >= 0),
  baseline_action_rate numeric not null default 0 check (baseline_action_rate >= 0),
  effectiveness_boost integer not null default 0 check (effectiveness_boost between -10 and 10),
  effectiveness_score integer not null default 50 check (effectiveness_score between 0 and 100),
  last_measured_at timestamptz,
  refreshed_at timestamptz not null default now(),
  primary key (restaurant_id,seed_query)
);

create index if not exists trend_seed_effectiveness_score_idx
  on private.trend_seed_effectiveness(effectiveness_score desc,sample_count desc);

revoke all on table private.trend_seed_effectiveness from public,anon,authenticated;

create or replace function private.refresh_trend_seed_effectiveness(p_restaurant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_upserted integer := 0;
begin
  with perf_by_post as (
    select
      p.id as post_id,
      p.restaurant_id,
      lower(trim(coalesce(p.generation_meta->>'trend_seed',''))) as trend_seed,
      max(pp.measured_at) as last_measured_at,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.reach) filter (where pp.platform='combined'),0) else coalesce(sum(pp.reach) filter (where pp.platform<>'combined'),0) end::numeric as reach,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.likes) filter (where pp.platform='combined'),0) else coalesce(sum(pp.likes) filter (where pp.platform<>'combined'),0) end::numeric as likes,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.comments) filter (where pp.platform='combined'),0) else coalesce(sum(pp.comments) filter (where pp.platform<>'combined'),0) end::numeric as comments,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.saves) filter (where pp.platform='combined'),0) else coalesce(sum(pp.saves) filter (where pp.platform<>'combined'),0) end::numeric as saves,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.shares) filter (where pp.platform='combined'),0) else coalesce(sum(pp.shares) filter (where pp.platform<>'combined'),0) end::numeric as shares,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.clicks) filter (where pp.platform='combined'),0) else coalesce(sum(pp.clicks) filter (where pp.platform<>'combined'),0) end::numeric as clicks,
      case when bool_or(pp.platform='combined') then coalesce(max(pp.conversions) filter (where pp.platform='combined'),0) else coalesce(sum(pp.conversions) filter (where pp.platform<>'combined'),0) end::numeric as conversions
    from public.posts p
    join public.post_performance pp on pp.post_id=p.id
    where p.created_at >= now()-interval '180 days'
      and (p_restaurant_id is null or p.restaurant_id=p_restaurant_id)
    group by p.id,p.restaurant_id,p.generation_meta
  ),
  baseline as (
    select restaurant_id,
      sum(likes + comments*1.25 + saves*2.25 + shares*2.5 + clicks*1.5 + conversions*5) / greatest(sum(reach),1) as action_rate
    from perf_by_post group by restaurant_id
  ),
  seed_stats as (
    select p.restaurant_id,p.trend_seed,count(*)::integer as sample_count,sum(p.reach)::bigint as reach_sum,
      sum(p.likes + p.comments*1.25 + p.saves*2.25 + p.shares*2.5 + p.clicks*1.5 + p.conversions*5) as weighted_actions,
      sum(p.likes + p.comments*1.25 + p.saves*2.25 + p.shares*2.5 + p.clicks*1.5 + p.conversions*5) / greatest(sum(p.reach),1) as action_rate,
      b.action_rate as baseline_action_rate,max(p.last_measured_at) as last_measured_at
    from perf_by_post p join baseline b on b.restaurant_id=p.restaurant_id
    where p.trend_seed<>''
    group by p.restaurant_id,p.trend_seed,b.action_rate
  ),
  scored as (
    select *, least(10,greatest(-10,round(case when baseline_action_rate<=0 then 0 else (action_rate-baseline_action_rate)*100 * least(1.0,sample_count/5.0) end)))::integer as effectiveness_boost
    from seed_stats
  ),
  upserted as (
    insert into private.trend_seed_effectiveness(restaurant_id,seed_query,sample_count,reach_sum,weighted_actions,action_rate,baseline_action_rate,effectiveness_boost,effectiveness_score,last_measured_at,refreshed_at)
    select restaurant_id,trend_seed,sample_count,reach_sum,weighted_actions,action_rate,baseline_action_rate,effectiveness_boost,least(100,greatest(0,50+effectiveness_boost*5)),last_measured_at,now()
    from scored
    on conflict (restaurant_id,seed_query) do update set
      sample_count=excluded.sample_count,reach_sum=excluded.reach_sum,weighted_actions=excluded.weighted_actions,
      action_rate=excluded.action_rate,baseline_action_rate=excluded.baseline_action_rate,effectiveness_boost=excluded.effectiveness_boost,
      effectiveness_score=excluded.effectiveness_score,last_measured_at=excluded.last_measured_at,refreshed_at=now()
    returning 1
  )
  select count(*)::integer into v_upserted from upserted;
  return jsonb_build_object('ok',true,'upserted',coalesce(v_upserted,0),'restaurant_id',p_restaurant_id,'refreshed_at',now());
end;
$function$;

revoke all on function private.refresh_trend_seed_effectiveness(uuid) from public,anon,authenticated;

create or replace function public.service_refresh_trend_seed_effectiveness(p_restaurant_id uuid default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
begin
  if current_user <> 'service_role' then raise exception 'Forbidden'; end if;
  return private.refresh_trend_seed_effectiveness(p_restaurant_id);
end;
$function$;

revoke all on function public.service_refresh_trend_seed_effectiveness(uuid) from public,anon,authenticated;
grant execute on function public.service_refresh_trend_seed_effectiveness(uuid) to service_role;

create or replace function private.admin_trend_effectiveness_feed(p_limit integer default 40)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.sample_count desc,x.effectiveness_score desc,x.seed_query)
    from (select e.restaurant_id,r.name as restaurant_name,e.seed_query,e.sample_count,e.reach_sum,
      round(e.action_rate*100,2) as action_rate_pct,round(e.baseline_action_rate*100,2) as baseline_action_rate_pct,
      e.effectiveness_boost,e.effectiveness_score,e.last_measured_at,e.refreshed_at
      from private.trend_seed_effectiveness e join public.restaurants r on r.id=e.restaurant_id
      order by e.sample_count desc,e.effectiveness_score desc,e.seed_query
      limit greatest(1,least(coalesce(p_limit,40),200))) x),'[]'::jsonb);
end;
$function$;

revoke all on function private.admin_trend_effectiveness_feed(integer) from public,anon,authenticated;

create or replace function public.admin_trend_effectiveness_feed(p_limit integer default 40)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.admin_trend_effectiveness_feed(p_limit); $function$;

revoke all on function public.admin_trend_effectiveness_feed(integer) from public,anon;
grant execute on function public.admin_trend_effectiveness_feed(integer) to authenticated;

select private.refresh_trend_seed_effectiveness(null);
select cron.unschedule('restaurant-autopilot-trend-opportunities');
select cron.schedule('restaurant-autopilot-trend-opportunities','25 */6 * * *',$cron$
  select private.refresh_trend_seed_effectiveness(null);
  select private.refresh_trend_content_opportunities(null);
$cron$);