create table if not exists public.autopilot_activity (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'preflight_checked',
    'weekly_plan_created',
    'weekly_review_completed',
    'performance_imported',
    'menu_imported',
    'ai_images_generated',
    'schedule_adjusted'
  )),
  title text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.autopilot_activity enable row level security;

drop policy if exists autopilot_activity_select_access on public.autopilot_activity;
create policy autopilot_activity_select_access
on public.autopilot_activity
for select
to authenticated
using (public.owns_restaurant(restaurant_id) or private.is_superadmin());

revoke all on table public.autopilot_activity from anon;
revoke insert, update, delete on table public.autopilot_activity from authenticated;
grant select on table public.autopilot_activity to authenticated;

create index if not exists autopilot_activity_restaurant_created_idx
on public.autopilot_activity(restaurant_id, created_at desc);

create index if not exists autopilot_activity_restaurant_type_idx
on public.autopilot_activity(restaurant_id, event_type, created_at desc);
