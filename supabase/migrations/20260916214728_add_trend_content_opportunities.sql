
create table if not exists public.trend_content_opportunities (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  candidate_id uuid not null references private.discovery_candidates(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  trend_query text not null,
  seed_query text not null,
  trend_type text not null check (trend_type in ('rising','top')),
  trend_value text,
  trend_signal integer not null default 0 check (trend_signal >= 0),
  relevance_score integer not null default 50 check (relevance_score between 0 and 100),
  opportunity_score integer not null default 50 check (opportunity_score between 0 and 100),
  recommended_pillar text not null default 'local_discovery',
  recommended_action text not null default 'post' check (recommended_action in ('post','campaign')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','created','dismissed','expired')),
  created_post_id uuid references public.posts(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trend_content_opportunities enable row level security;

drop policy if exists trend_opportunities_select_access on public.trend_content_opportunities;
create policy trend_opportunities_select_access
on public.trend_content_opportunities
for select
to authenticated
using (
  public.owns_restaurant(restaurant_id)
  or private.is_superadmin()
);

revoke all on table public.trend_content_opportunities from public,anon,authenticated;
grant select on table public.trend_content_opportunities to authenticated;

create unique index if not exists trend_opportunities_unique_match
  on public.trend_content_opportunities (restaurant_id,candidate_id,menu_item_id);

create index if not exists trend_opportunities_active_idx
  on public.trend_content_opportunities (restaurant_id,status,opportunity_score desc,expires_at)
  where status='pending';

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

  with matched as (
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
      )))::integer as opportunity_score,
      case
        when lower(c.seed_query) in ('pizza','burger','street food') then 'hero_dish'
        when lower(c.seed_query)='domaća hrana' then 'local_discovery'
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
      on (p_restaurant_id is null or r.id=p_restaurant_id)
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
    left join lateral (
      select m.*
      from public.menu_items m
      where m.restaurant_id=r.id
        and m.is_active
        and (
          lower(c.seed_query) in ('restoran','restaurant')
          or (
            lower(c.seed_query)='pizza'
            and lower(coalesce(m.name,'')||' '||coalesce(m.category,'')||' '||coalesce(r.cuisine_type,'')) like '%pizza%'
          )
          or (
            lower(c.seed_query)='burger'
            and (
              lower(coalesce(m.name,'')||' '||coalesce(m.category,'')||' '||coalesce(r.cuisine_type,'')) like '%burger%'
              or lower(coalesce(r.cuisine_type,'')) like '%fast%'
            )
          )
          or (
            lower(c.seed_query)='street food'
            and (
              lower(coalesce(m.name,'')||' '||coalesce(m.category,'')||' '||coalesce(r.cuisine_type,'')) like '%street%'
              or lower(coalesce(r.cuisine_type,'')) like '%fast%'
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
  counted as (
    select count(*)::integer as cnt from matched
  ),
  upserted as (
    insert into public.trend_content_opportunities(
      restaurant_id,candidate_id,menu_item_id,trend_query,seed_query,trend_type,
      trend_value,trend_signal,relevance_score,opportunity_score,recommended_pillar,
      recommended_action,reason,expires_at,updated_at
    )
    select
      restaurant_id,candidate_id,menu_item_id,trend_query,seed_query,trend_type,
      trend_value,trend_signal,relevance_score,opportunity_score,recommended_pillar,
      recommended_action,reason,expires_at,now()
    from matched
    on conflict (restaurant_id,candidate_id,menu_item_id)
    do update set
      trend_query=excluded.trend_query,
      trend_type=excluded.trend_type,
      trend_value=excluded.trend_value,
      trend_signal=excluded.trend_signal,
      relevance_score=excluded.relevance_score,
      opportunity_score=excluded.opportunity_score,
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

create or replace function public.service_refresh_trend_content_opportunities(p_restaurant_id uuid default null)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select private.refresh_trend_content_opportunities(p_restaurant_id);
$function$;

revoke all on function public.service_refresh_trend_content_opportunities(uuid) from public,anon,authenticated;
grant execute on function public.service_refresh_trend_content_opportunities(uuid) to service_role;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-trend-opportunities');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-trend-opportunities',
  '25 */6 * * *',
  $cron$
    select private.refresh_trend_content_opportunities(null);
  $cron$
);
