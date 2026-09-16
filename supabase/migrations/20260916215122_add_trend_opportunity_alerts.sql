
alter table public.notification_outbox
  drop constraint if exists notification_outbox_kind_check;

alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind = any (array[
    'order_created'::text,
    'order_paid'::text,
    'trial_started'::text,
    'license_activated'::text,
    'subscription_expiring'::text,
    'subscription_expired'::text,
    'admin_note'::text,
    'support_created'::text,
    'performance_reminder'::text,
    'weekly_plan_ready'::text,
    'trend_opportunity'::text
  ]));

create or replace function private.notify_high_trend_opportunities()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inserted integer := 0;
begin
  insert into public.notification_outbox(
    user_id,
    recipient_email,
    kind,
    subject,
    body,
    payload,
    delivery_status,
    visible_in_app
  )
  select
    r.owner_id,
    cp.email,
    'trend_opportunity',
    'Nova jaka trend prilika',
    'Trend „'||o.trend_query||'“ odgovara ponudi restorana '||r.name||' i ima opportunity score '||o.opportunity_score||'/100.',
    jsonb_build_object(
      'restaurant_id',o.restaurant_id,
      'opportunity_id',o.id,
      'menu_item_id',o.menu_item_id,
      'trend_query',o.trend_query,
      'opportunity_score',o.opportunity_score
    ),
    'in_app',
    true
  from public.trend_content_opportunities o
  join public.restaurants r on r.id=o.restaurant_id
  left join public.customer_profiles cp on cp.user_id=r.owner_id
  where o.status='pending'
    and o.expires_at>now()
    and o.opportunity_score>=80
    and not exists (
      select 1
      from public.notification_outbox n
      where n.kind='trend_opportunity'
        and n.user_id=r.owner_id
        and n.payload->>'opportunity_id'=o.id::text
    );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok',true,
    'inserted',v_inserted,
    'finished_at',now()
  );
end;
$function$;

revoke all on function private.notify_high_trend_opportunities() from public,anon,authenticated;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-trend-alerts');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-trend-alerts',
  '35 */6 * * *',
  $cron$
    select private.notify_high_trend_opportunities();
  $cron$
);
