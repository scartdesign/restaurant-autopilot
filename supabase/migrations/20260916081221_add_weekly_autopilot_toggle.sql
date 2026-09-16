alter table public.restaurants
  add column if not exists weekly_autopilot_enabled boolean not null default false;
