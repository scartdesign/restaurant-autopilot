create or replace function private.trend_seed_matches(
  p_seed text,
  p_menu_name text,
  p_category text,
  p_cuisine text
)
returns boolean
language sql
immutable
security invoker
set search_path to ''
as $function$
  with x as (
    select
      lower(trim(coalesce(p_seed,''))) as seed,
      lower(coalesce(p_menu_name,'')||' '||coalesce(p_category,'')||' '||coalesce(p_cuisine,'')) as hay
  )
  select case
    when seed='' then false
    when seed in ('restoran','restaurant') then true
    when position(seed in hay)>0 then true
    when seed in ('dessert','desert') then hay like any(array['%dessert%','%desert%','%slatk%','%kolač%','%kolac%','%tort%'])
    when seed in ('salata','salad') then hay like any(array['%salat%','%salad%'])
    when seed in ('italian','italijanska','italijanski') then hay like any(array['%italian%','%italij%'])
    when seed in ('balkan','balkanska','balkanski') then hay like any(array['%balkan%','%doma%','%trad%','%srp%'])
    when seed='domaća hrana' or seed='domaca hrana' then hay like any(array['%doma%','%trad%','%balkan%','%srp%'])
    when seed='pasta' then hay like any(array['%pasta%','%testenin%'])
    when seed='pizza' then hay like any(array['%pizza%','%pica%'])
    when seed='burger' then hay like any(array['%burger%','%hamburger%','%fast food%','%fastfood%'])
    when seed='street food' then hay like any(array['%street food%','%streetfood%','%fast food%','%fastfood%','%burger%'])
    when seed='steak' then hay like any(array['%steak%','%stejk%','%biftek%'])
    else false
  end
  from x;
$function$;

revoke all on function private.trend_seed_matches(text,text,text,text) from public,anon,authenticated;
grant execute on function private.trend_seed_matches(text,text,text,text) to service_role;

create or replace function private.refresh_trend_content_opportunities(p_restaurant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_seen integer := 0;
  v_upserted integer := 0;
begin
  update public.trend_content_opportunities
  set status='expired',updated_at=now()
  where status='pending' and expires_at <= now();

  update public.trend_content_opportunities o
  set status='expired',updated_at=now()
  where o.status='pending'
    and exists (
      select 1
      from private.discovery_candidates c
      where c.id=o.candidate_id
        and (
          (c.trend_type='rising' and c.last_seen_at < now()-interval '7 days')
          or
          (c.trend_type='top' and c.last_seen_at < now()-interval '21 days')
        )
    );

  with perf_by_post as (
    select
      p.id as post_id,
      p.restaurant_id,
      lower(coalesce(p.generation_meta->>'trend_seed','')) as trend_seed,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.reach) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.reach) filter (where pp.platform<>'combined'),0)
      end::numeric as reach,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.likes) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.likes) filter (where pp.platform<>'combined'),0)
      end::numeric as likes,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.comments) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.comments) filter (where pp.platform<>'combined'),0)
      end::numeric as comments,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.saves) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.saves) filter (where pp.platform<>'combined'),0)
      end::numeric as saves,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.shares) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.shares) filter (where pp.platform<>'combined'),0)
      end::numeric as shares,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.clicks) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.clicks) filter (where pp.platform<>'combined'),0)
      end::numeric as clicks,
      case when bool_or(pp.platform='combined')
        then coalesce(max(pp.conversions) filter (where pp.platform='combined'),0)
        else coalesce(sum(pp.conversions) filter (where pp.platform<>'combined'),0)
      end::numeric as conversions
    from public.posts p
    join public.post_performance pp on pp.post_id=p.id
    where p.created_at >= now()-interval '180 days'
    group by p.id,p.restaurant_id,p.generation_meta
  ),
  perf_restaurant as (
    select
      restaurant_id,
      count(*)::integer as samples,
      (
        sum(likes + comments*1.25 + saves*2.25 + shares*2.5 + clicks*1.5 + conversions*5)
        / greatest(sum(reach),1)
      )::numeric as action_rate
    from perf_by_post
    group by restaurant_id
  ),
  perf_seed as (
    select
      restaurant_id,
      trend_seed,
      count(*)::integer as samples,
      (
        sum(likes + comments*1.25 + saves*2.25 + shares*2.5 + clicks*1.5 + conversions*5)
        / greatest(sum(reach),1)
      )::numeric as action_rate
    from perf_by_post
    where trend_seed<>''
    group by restaurant_id,trend_seed
  ),
  matched_base as (
    select
      r.id as restaurant_id,
      c.id as candidate_id,
      mi.id as menu_item_id,
      c.query as trend_query,
      c.seed_query,
      c.trend_type,
      c.trend_value,
      c.extracted_value as trend_signal,
      c.relevance_score,
      c.last_seen_at as candidate_last_seen_at,
      case
        when c.trend_type='rising' and c.last_seen_at >= now()-interval '24 hours' then 0
        when c.trend_type='rising' and c.last_seen_at >= now()-interval '72 hours' then 3
        when c.trend_type='rising' and c.last_seen_at >= now()-interval '120 hours' then 7
        when c.trend_type='rising' then 12
        when c.last_seen_at >= now()-interval '7 days' then 0
        when c.last_seen_at >= now()-interval '14 days' then 4
        else 8
      end::integer as freshness_penalty,
      least(100,greatest(0,round(
        c.relevance_score * 0.62
        + least(24,ln(greatest(c.extracted_value,0)+1)*3.2)
        + coalesce(mi.marketing_priority,0)*4
        + case when mi.image_url is not null then 6 else 0 end
      )))::integer as base_score,
      coalesce(ps.samples,0)::integer as performance_samples,
      coalesce(ps.action_rate,0)::numeric as seed_action_rate,
      coalesce(pr.action_rate,0)::numeric as restaurant_action_rate,
      case
        when lower(c.seed_query) in ('pizza','burger','street food','pasta','sushi','steak','dessert','desert') then 'hero_dish'
        else 'local_discovery'
      end as recommended_pillar,
      case
        when c.trend_type='rising'
         and c.relevance_score >= 70
         and c.extracted_value >= 300
        then 'campaign'
        else 'post'
      end as recommended_action,
      case
        when c.trend_type='rising'
        then 'Rastuća tema „'||c.query||'“ odgovara ponudi restorana i može da se iskoristi dok interes raste.'
        else 'Tema „'||c.query||'“ je stabilno tražena i odgovara ponudi restorana.'
      end as reason,
      case when c.trend_type='rising' then now()+interval '10 days' else now()+interval '21 days' end as expires_at
    from private.discovery_candidates c
    join public.restaurants r
      on r.trend_autopilot_mode <> 'off'
     and (p_restaurant_id is null or r.id=p_restaurant_id)
     and (
       c.geo=''
       or (
         c.geo='RS'
         and (
           lower(coalesce(r.country,'')) like '%serb%'
           or lower(coalesce(r.country,'')) like '%srb%'
           or coalesce(r.country,'')=''
         )
       )
     )
    left join perf_restaurant pr on pr.restaurant_id=r.id
    left join perf_seed ps
      on ps.restaurant_id=r.id
     and ps.trend_seed=lower(c.seed_query)
    left join lateral (
      select m.*
      from public.menu_items m
      where m.restaurant_id=r.id
        and m.is_active
        and private.trend_seed_matches(c.seed_query,m.name,m.category,r.cuisine_type)
      order by
        m.marketing_priority desc,
        (m.image_url is not null) desc,
        m.updated_at desc
      limit 1
    ) mi on true
    where c.status='approved'
      and (
        (c.trend_type='rising' and c.last_seen_at >= now()-interval '7 days')
        or
        (c.trend_type='top' and c.last_seen_at >= now()-interval '21 days')
      )
      and (
        lower(c.seed_query) in ('restoran','restaurant')
        or mi.id is not null
      )
  ),
  matched as (
    select
      *,
      least(10,greatest(-10,round(
        case
          when performance_samples=0 or restaurant_action_rate<=0 then 0
          else (seed_action_rate-restaurant_action_rate)*100
               * least(1.0,performance_samples/5.0)
        end
      )))::integer as performance_boost
    from matched_base
  ),
  counted as (
    select count(*)::integer as cnt from matched
  ),
  upserted as (
    insert into public.trend_content_opportunities(
      restaurant_id,candidate_id,menu_item_id,trend_query,seed_query,trend_type,
      trend_value,trend_signal,relevance_score,opportunity_score,performance_boost,
      performance_samples,candidate_last_seen_at,freshness_penalty,recommended_pillar,
      recommended_action,reason,expires_at,updated_at
    )
    select
      restaurant_id,candidate_id,menu_item_id,trend_query,seed_query,trend_type,
      trend_value,trend_signal,relevance_score,
      least(100,greatest(0,base_score+performance_boost-freshness_penalty)),
      performance_boost,performance_samples,candidate_last_seen_at,freshness_penalty,
      recommended_pillar,recommended_action,reason,expires_at,now()
    from matched
    on conflict (restaurant_id,candidate_id,menu_item_id)
    do update set
      trend_query=excluded.trend_query,
      trend_type=excluded.trend_type,
      trend_value=excluded.trend_value,
      trend_signal=excluded.trend_signal,
      relevance_score=excluded.relevance_score,
      opportunity_score=excluded.opportunity_score,
      performance_boost=excluded.performance_boost,
      performance_samples=excluded.performance_samples,
      candidate_last_seen_at=excluded.candidate_last_seen_at,
      freshness_penalty=excluded.freshness_penalty,
      recommended_pillar=excluded.recommended_pillar,
      recommended_action=excluded.recommended_action,
      reason=excluded.reason,
      expires_at=case
        when public.trend_content_opportunities.status='pending' then excluded.expires_at
        else public.trend_content_opportunities.expires_at
      end,
      updated_at=now()
    returning id
  )
  select
    (select cnt from counted),
    (select count(*)::integer from upserted)
  into v_seen,v_upserted;

  return jsonb_build_object(
    'ok',true,
    'matched',coalesce(v_seen,0),
    'upserted',coalesce(v_upserted,0),
    'restaurant_id',p_restaurant_id,
    'finished_at',now()
  );
end;
$function$;

revoke all on function private.refresh_trend_content_opportunities(uuid) from public,anon,authenticated;
grant execute on function private.refresh_trend_content_opportunities(uuid) to service_role;
