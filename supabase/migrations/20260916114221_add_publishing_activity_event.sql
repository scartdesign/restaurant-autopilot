alter table public.autopilot_activity
  drop constraint if exists autopilot_activity_event_type_check;

alter table public.autopilot_activity
  add constraint autopilot_activity_event_type_check
  check (event_type in (
    'preflight_checked',
    'weekly_plan_created',
    'weekly_review_completed',
    'performance_imported',
    'menu_imported',
    'ai_images_generated',
    'schedule_adjusted',
    'publishing_confirmed'
  ));
