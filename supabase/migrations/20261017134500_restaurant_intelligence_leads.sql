-- Internal SCART sales CRM; separate from customer-owned restaurant records.
create table if not exists public.restaurant_intelligence_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  city text not null default '',
  website text not null default '',
  email text not null default '',
  stage text not null default 'new' check (stage in ('new','audit','qualified','offer','contacted','negotiation','won','lost')),
  findings jsonb not null default '[]'::jsonb check (jsonb_typeof(findings) = 'array'),
  next_action text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists restaurant_intelligence_leads_name_city_unique
  on public.restaurant_intelligence_leads (lower(trim(name)), lower(trim(city)));
create index if not exists restaurant_intelligence_leads_stage_idx on public.restaurant_intelligence_leads(stage);
alter table public.restaurant_intelligence_leads enable row level security;
revoke all on public.restaurant_intelligence_leads from anon;
grant select, insert, update, delete on public.restaurant_intelligence_leads to authenticated;
drop policy if exists intelligence_owner_select on public.restaurant_intelligence_leads;
drop policy if exists intelligence_owner_insert on public.restaurant_intelligence_leads;
drop policy if exists intelligence_owner_update on public.restaurant_intelligence_leads;
drop policy if exists intelligence_owner_delete on public.restaurant_intelligence_leads;
create policy intelligence_owner_select on public.restaurant_intelligence_leads
  for select to authenticated using (public.is_superadmin());
create policy intelligence_owner_insert on public.restaurant_intelligence_leads
  for insert to authenticated with check (public.is_superadmin() and created_by = (select auth.uid()));
create policy intelligence_owner_update on public.restaurant_intelligence_leads
  for update to authenticated using (public.is_superadmin())
  with check (public.is_superadmin());
create policy intelligence_owner_delete on public.restaurant_intelligence_leads
  for delete to authenticated using (public.is_superadmin());
comment on table public.restaurant_intelligence_leads is
  'Private SCART sales prospects, unrelated to customer restaurant tenant data. Admin only via RLS.';
