create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'meta' check (provider = 'meta'),
  status text not null default 'pending_oauth' check (status in ('pending_oauth','pending_page_selection','connected','expired','error','disconnected')),
  page_id text,
  page_name text,
  instagram_business_account_id text,
  instagram_username text,
  token_secret_id uuid,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connection_meta jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

alter table public.social_connections enable row level security;

drop policy if exists social_connections_select_access on public.social_connections;
create policy social_connections_select_access
on public.social_connections
for select
to authenticated
using (public.owns_restaurant(restaurant_id) or private.is_superadmin());

revoke all on table public.social_connections from anon;
revoke insert, update, delete on table public.social_connections from authenticated;
grant select on table public.social_connections to authenticated;

create index if not exists social_connections_restaurant_status_idx on public.social_connections(restaurant_id,status);
create index if not exists social_connections_user_idx on public.social_connections(user_id);

create table if not exists public.meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  redirect_to text,
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.meta_oauth_states enable row level security;
revoke all on table public.meta_oauth_states from anon, authenticated;
create index if not exists meta_oauth_states_expiry_idx on public.meta_oauth_states(expires_at);

create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  status text not null default 'queued' check (status in ('queued','processing','published','failed','cancelled')),
  publish_at timestamptz not null,
  attempt_count integer not null default 0,
  provider_media_id text,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.social_publish_jobs enable row level security;

drop policy if exists social_publish_jobs_select_access on public.social_publish_jobs;
create policy social_publish_jobs_select_access
on public.social_publish_jobs
for select
to authenticated
using (public.owns_restaurant(restaurant_id) or private.is_superadmin());

revoke all on table public.social_publish_jobs from anon;
revoke insert, update, delete on table public.social_publish_jobs from authenticated;
grant select on table public.social_publish_jobs to authenticated;

create index if not exists social_publish_jobs_due_idx
on public.social_publish_jobs(status,publish_at)
where status='queued';

create index if not exists social_publish_jobs_restaurant_idx
on public.social_publish_jobs(restaurant_id,created_at desc);

create unique index if not exists social_publish_jobs_active_unique_idx
on public.social_publish_jobs(post_id,platform)
where status <> 'cancelled';

create or replace function private.admin_meta_provider_status()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_app boolean;
  v_secret boolean;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_meta_app_id') into v_app;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_meta_app_secret') into v_secret;
  return jsonb_build_object('configured',v_app and v_secret,'provider','meta','app_id',v_app,'app_secret',v_secret);
end;
$function$;

revoke all on function private.admin_meta_provider_status() from public, anon;
grant execute on function private.admin_meta_provider_status() to authenticated;

create or replace function public.admin_meta_provider_status()
returns jsonb
language sql
set search_path to ''
as $function$ select private.admin_meta_provider_status(); $function$;

revoke all on function public.admin_meta_provider_status() from public, anon;
grant execute on function public.admin_meta_provider_status() to authenticated;

create or replace function private.admin_set_meta_provider(p_app_id text,p_app_secret text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_app text := trim(coalesce(p_app_id,''));
  v_secret text := trim(coalesce(p_app_secret,''));
  v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if length(v_app) < 5 or v_app !~ '^[0-9]+$' then raise exception 'Meta App ID nije validan'; end if;
  if length(v_secret) < 20 then raise exception 'Meta App Secret nije validan'; end if;

  select id into v_id from vault.secrets where name='restaurant_autopilot_meta_app_id' order by updated_at desc limit 1;
  if v_id is null then
    perform vault.create_secret(v_app,'restaurant_autopilot_meta_app_id','Restaurant Autopilot Meta App ID');
  else
    perform vault.update_secret(v_id,v_app,'restaurant_autopilot_meta_app_id','Restaurant Autopilot Meta App ID');
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name='restaurant_autopilot_meta_app_secret' order by updated_at desc limit 1;
  if v_id is null then
    perform vault.create_secret(v_secret,'restaurant_autopilot_meta_app_secret','Restaurant Autopilot Meta App Secret');
  else
    perform vault.update_secret(v_id,v_secret,'restaurant_autopilot_meta_app_secret','Restaurant Autopilot Meta App Secret');
  end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'meta_provider_updated','system',null,jsonb_build_object('provider','meta'));
  return true;
end;
$function$;

revoke all on function private.admin_set_meta_provider(text,text) from public, anon;
grant execute on function private.admin_set_meta_provider(text,text) to authenticated;

create or replace function public.admin_set_meta_provider(p_app_id text,p_app_secret text)
returns boolean
language sql
set search_path to ''
as $function$ select private.admin_set_meta_provider(p_app_id,p_app_secret); $function$;

revoke all on function public.admin_set_meta_provider(text,text) from public, anon;
grant execute on function public.admin_set_meta_provider(text,text) to authenticated;

create or replace function public.service_meta_config()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_app text;
  v_secret text;
begin
  select decrypted_secret into v_app from vault.decrypted_secrets where name='restaurant_autopilot_meta_app_id' order by updated_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='restaurant_autopilot_meta_app_secret' order by updated_at desc limit 1;
  return jsonb_build_object('configured',v_app is not null and v_secret is not null,'app_id',v_app,'app_secret',v_secret);
end;
$function$;

revoke all on function public.service_meta_config() from public, anon, authenticated;
grant execute on function public.service_meta_config() to service_role;

create or replace function public.service_store_social_token(p_connection_id uuid,p_token text,p_expires_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_name text := 'restaurant_autopilot_meta_connection_'||p_connection_id::text;
  v_id uuid;
begin
  if length(coalesce(p_token,'')) < 20 then raise exception 'Token is invalid'; end if;
  if not exists(select 1 from public.social_connections where id=p_connection_id) then raise exception 'Connection not found'; end if;
  select id into v_id from vault.secrets where name=v_name order by updated_at desc limit 1;
  if v_id is null then
    select vault.create_secret(p_token,v_name,'Restaurant Autopilot Meta page/user token') into v_id;
  else
    perform vault.update_secret(v_id,p_token,v_name,'Restaurant Autopilot Meta page/user token');
  end if;
  update public.social_connections set token_secret_id=v_id,token_expires_at=p_expires_at,updated_at=now() where id=p_connection_id;
  return v_id;
end;
$function$;

revoke all on function public.service_store_social_token(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.service_store_social_token(uuid,text,timestamptz) to service_role;

create or replace function public.service_get_social_token(p_connection_id uuid)
returns text
language sql
security definer
set search_path to ''
as $function$
  select ds.decrypted_secret
  from public.social_connections sc
  join vault.decrypted_secrets ds on ds.id=sc.token_secret_id
  where sc.id=p_connection_id;
$function$;

revoke all on function public.service_get_social_token(uuid) from public, anon, authenticated;
grant execute on function public.service_get_social_token(uuid) to service_role;

alter table public.autopilot_activity drop constraint if exists autopilot_activity_event_type_check;
alter table public.autopilot_activity
add constraint autopilot_activity_event_type_check
check (event_type in (
  'preflight_checked','weekly_plan_created','weekly_review_completed',
  'performance_imported','menu_imported','ai_images_generated',
  'schedule_adjusted','publishing_confirmed','opportunity_test_created',
  'social_connected','publish_queued','publish_success','publish_failed'
));
