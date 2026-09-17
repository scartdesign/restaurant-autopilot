create or replace function private.notify_weekly_trend_digest()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inserted integer := 0;
  v_restaurants integer := 0;
begin
  with ranked as (
    select
      o.restaurant_id,
      r.owner_id,
      o.id,
      o.trend_query,
      o.seed_query,
      o.trend_type,
      o.opportunity_score,
      o.performance_boost,
      o.performance_samples,
      o.expires_at,
      row_number() over (
        partition by o.restaurant_id
        order by o.opportunity_score desc, o.expires_at asc, o.created_at desc
      ) as rn
    from public.trend_content_opportunities o
    join public.restaurants r on r.id=o.restaurant_id
    where o.status='pending'
      and o.expires_at>now()
      and o.opportunity_score>=70
      and r.trend_autopilot_mode in ('suggest','auto')
      and r.trend_weekly_digest_enabled
  ),
  grouped as (
    select
      restaurant_id,
      owner_id,
      count(*)::integer as opportunity_count,
      max(opportunity_score)::integer as max_score,
      (array_agg(id order by opportunity_score desc,expires_at asc))[1] as top_opportunity_id,
      jsonb_agg(
        jsonb_build_object(
          'id',id,
          'query',trend_query,
          'seed',seed_query,
          'type',trend_type,
          'score',opportunity_score,
          'performance_boost',performance_boost,
          'performance_samples',performance_samples,
          'expires_at',expires_at
        ) order by opportunity_score desc,expires_at asc
      ) as opportunities,
      string_agg(
        '• '||trend_query||' ('||opportunity_score||'/100)',
        E'\n' order by opportunity_score desc,expires_at asc
      ) as digest_lines
    from ranked
    where rn<=3
    group by restaurant_id,owner_id
  ),
  eligible as (
    select g.*
    from grouped g
    where not exists (
      select 1
      from public.notification_outbox n
      where n.kind='trend_weekly_digest'
        and n.user_id=g.owner_id
        and n.payload->>'restaurant_id'=g.restaurant_id::text
        and n.created_at>=date_trunc('week',now())
    )
  ),
  inserted as (
    insert into public.notification_outbox(
      user_id,recipient_email,kind,subject,body,payload,
      delivery_status,visible_in_app
    )
    select
      owner_id,
      null,
      'trend_weekly_digest',
      'Trend Weekly Brief · '||opportunity_count||case when opportunity_count=1 then ' jaka prilika' else ' jake prilike' end,
      'Najbolje trend prilike za ovu nedelju:'||E'\n'||digest_lines||E'\n\nOtvori Trend Radar i izaberi šta želiš da iskoristiš.',
      jsonb_build_object(
        'restaurant_id',restaurant_id,
        'top_opportunity_id',top_opportunity_id,
        'opportunity_count',opportunity_count,
        'max_score',max_score,
        'minimum_score',70,
        'opportunities',opportunities,
        'week_start',date_trunc('week',now())
      ),
      'in_app',
      true
    from eligible
    returning payload
  )
  select count(*)::integer,count(distinct payload->>'restaurant_id')::integer
  into v_inserted,v_restaurants
  from inserted;

  return jsonb_build_object(
    'ok',true,
    'minimum_score',70,
    'notifications_created',coalesce(v_inserted,0),
    'restaurants',coalesce(v_restaurants,0),
    'week_start',date_trunc('week',now()),
    'finished_at',now()
  );
end;
$function$;

revoke all on function private.notify_weekly_trend_digest() from public,anon,authenticated;