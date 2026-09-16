
alter table public.trend_content_opportunities
  add column if not exists performance_boost integer not null default 0 check (performance_boost between -10 and 10),
  add column if not exists performance_samples integer not null default 0 check (performance_samples >= 0);

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
        when lower(c.seed_query) in ('pizza','burger','street food','pasta','sushi','steak') then 'hero_dish'
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
        and (
          lower(c.seed_query) in ('restoran','restaurant')
          or position(lower(c.seed_query) in lower(
            coalesce(m.name,'')||' '||
            coalesce(m.category,'')||' '||
            coalesce(r.cuisine_type,'')
          ))>0
          or (
            lower(c.seed_query)='burger'
            and lower(coalesce(r.cuisine_type,'')) like '%fast%'
          )
          or (
            lower(c.seed_query)='street food'
            and (
              lower(coalesce(r.cuisine_type,'')) like '%fast%'
              or lower(coalesce(m.name,'')) like '%burger%'
            )
          )
          or (
            lower(c.seed_query)='domaća hrana'
            and (
              lower(coalesce(m.name,'')||' '||coalesce(m.category,'')||' '||coalesce(r.cuisine_type,'')) like '%doma%'
              or lower(coalesce(r.cuisine_type,'')) like '%trad%'
              or lower(coalesce(r.cuisine_type,'')) like '%balkan%'
              or lower(coalesce(r.cuisine_type,'')) like '%srp%'
            )
          )
        )
      order by
        m.marketing_priority desc,
        (m.image_url is not null) desc,
        m.updated_at desc
      limit 1
    ) mi on true
    where c.status='approved'
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
      performance_samples,recommended_pillar,recommended_action,reason,expires_at,updated_at
    )
    select
      restaurant_id,candidate_id,menu_item_id,trend_query,seed_query,trend_type,
      trend_value,trend_signal,relevance_score,
      least(100,greatest(0,base_score+performance_boost)),
      performance_boost,performance_samples,recommended_pillar,recommended_action,
      reason,expires_at,now()
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
