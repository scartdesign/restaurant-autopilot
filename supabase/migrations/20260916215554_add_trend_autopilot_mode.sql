
alter table public.restaurants
  add column if not exists trend_autopilot_mode text not null default 'suggest';

do $block$
begin
  alter table public.restaurants
    add constraint restaurants_trend_autopilot_mode_check
    check (trend_autopilot_mode in ('off','suggest','auto'));
exception when duplicate_object then null;
end;
$block$;

CREATE OR REPLACE FUNCTION private.refresh_trend_content_opportunities(p_restaurant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-trend-auto-drafts');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-trend-auto-drafts',
  '45 */6 * * *',
  $cron$
    select net.http_post(
      url := 'https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/trend-autopilot',
      body := '{"action":"process_cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='restaurant_autopilot_discovery_cron'
          order by updated_at desc
          limit 1
        )
      ),
      timeout_milliseconds := 45000
    );
  $cron$
);
