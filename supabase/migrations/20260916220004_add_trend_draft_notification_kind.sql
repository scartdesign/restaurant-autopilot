
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
    'trend_opportunity'::text,
    'trend_draft_ready'::text
  ]));
