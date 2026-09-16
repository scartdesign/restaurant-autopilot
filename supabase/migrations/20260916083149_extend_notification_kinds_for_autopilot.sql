alter table public.notification_outbox
  drop constraint if exists notification_outbox_kind_check;

alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind = any (array[
    'order_created','order_paid','trial_started','license_activated',
    'subscription_expiring','subscription_expired','admin_note','support_created',
    'performance_reminder','weekly_plan_ready'
  ]::text[]));

alter table public.notification_outbox
  drop constraint if exists notification_outbox_delivery_status_check;

alter table public.notification_outbox
  add constraint notification_outbox_delivery_status_check
  check (delivery_status = any (array['queued','sent','failed','dismissed','in_app']::text[]));
