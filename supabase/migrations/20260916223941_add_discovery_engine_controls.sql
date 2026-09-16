
create table if not exists private.discovery_engine_settings (
  id smallint primary key default 1 check (id=1),
  provider_enabled boolean not null default true,
  per_sync_call_limit integer not null default 18 check (per_sync_call_limit between 1 and 100),
  daily_call_limit integer not null default 60 check (daily_call_limit between 1 and 1000),
  candidate_seed_limit integer not null default 8 check (candidate_seed_limit between 0 and 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into private.discovery_engine_settings(id)
values(1)
on conflict(id) do nothing;

create table if not exists private.discovery_seed_terms (
  id uuid primary key default gen_random_uuid(),
  geo text not null default '',
  query text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discovery_seed_terms_geo_query_uidx
  on private.discovery_seed_terms (geo, lower(query));

create index if not exists discovery_seed_terms_active_sort_idx
  on private.discovery_seed_terms (active, sort_order, geo);

insert into private.discovery_seed_terms(geo,query,active,sort_order)
select *
from (values
  ('RS','restoran',true,10),
  ('RS','pizza',true,20),
  ('RS','burger',true,30),
  ('RS','domaća hrana',true,40),
  ('','restaurant',true,50),
  ('','street food',true,60)
) as seed(geo,query,active,sort_order)
where not exists (
  select 1 from private.discovery_seed_terms s
  where s.geo=seed.geo and lower(s.query)=lower(seed.query)
);

revoke all on table private.discovery_engine_settings from public,anon,authenticated;
revoke all on table private.discovery_seed_terms from public,anon,authenticated;

create or replace function private.discovery_daily_api_calls_used()
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(sum(
    coalesce((metadata->>'api_calls')::integer,0)
    + coalesce((metadata->>'candidate_api_calls')::integer,0)
  ),0)::integer
  from private.discovery_sync_runs
  where source='serpapi_google_trends'
    and started_at >= date_trunc('day',now());
$function$;

revoke all on function private.discovery_daily_api_calls_used() from public,anon,authenticated;

create or replace function private.admin_discovery_engine_config()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_settings record;
  v_seeds jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select * into v_settings
  from private.discovery_engine_settings
  where id=1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'geo',geo,
    'query',query,
    'active',active,
    'sort_order',sort_order,
    'created_at',created_at,
    'updated_at',updated_at
  ) order by sort_order,geo,query),'[]'::jsonb)
  into v_seeds
  from private.discovery_seed_terms;

  return jsonb_build_object(
    'provider_enabled',v_settings.provider_enabled,
    'per_sync_call_limit',v_settings.per_sync_call_limit,
    'daily_call_limit',v_settings.daily_call_limit,
    'candidate_seed_limit',v_settings.candidate_seed_limit,
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'updated_at',v_settings.updated_at,
    'seeds',v_seeds
  );
end;
$function$;

revoke all on function private.admin_discovery_engine_config() from public,anon,authenticated;

create or replace function public.admin_discovery_engine_config()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_discovery_engine_config();
$function$;

revoke all on function public.admin_discovery_engine_config() from public,anon;
grant execute on function public.admin_discovery_engine_config() to authenticated;

create or replace function private.admin_update_discovery_engine_settings(
  p_provider_enabled boolean,
  p_per_sync_call_limit integer,
  p_daily_call_limit integer,
  p_candidate_seed_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if p_per_sync_call_limit not between 1 and 100 then raise exception 'per_sync_call_limit out of range'; end if;
  if p_daily_call_limit not between 1 and 1000 then raise exception 'daily_call_limit out of range'; end if;
  if p_candidate_seed_limit not between 0 and 50 then raise exception 'candidate_seed_limit out of range'; end if;

  update private.discovery_engine_settings
  set provider_enabled=p_provider_enabled,
      per_sync_call_limit=p_per_sync_call_limit,
      daily_call_limit=p_daily_call_limit,
      candidate_seed_limit=p_candidate_seed_limit,
      updated_at=now(),
      updated_by=auth.uid()
  where id=1;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'discovery_engine_settings_updated','discovery_engine','1',jsonb_build_object(
    'provider_enabled',p_provider_enabled,
    'per_sync_call_limit',p_per_sync_call_limit,
    'daily_call_limit',p_daily_call_limit,
    'candidate_seed_limit',p_candidate_seed_limit
  ));

  return private.admin_discovery_engine_config();
end;
$function$;

revoke all on function private.admin_update_discovery_engine_settings(boolean,integer,integer,integer) from public,anon,authenticated;

create or replace function public.admin_update_discovery_engine_settings(
  p_provider_enabled boolean,
  p_per_sync_call_limit integer,
  p_daily_call_limit integer,
  p_candidate_seed_limit integer
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_update_discovery_engine_settings(
    p_provider_enabled,p_per_sync_call_limit,p_daily_call_limit,p_candidate_seed_limit
  );
$function$;

revoke all on function public.admin_update_discovery_engine_settings(boolean,integer,integer,integer) from public,anon;
grant execute on function public.admin_update_discovery_engine_settings(boolean,integer,integer,integer) to authenticated;

create or replace function private.admin_upsert_discovery_seed(
  p_id uuid,
  p_query text,
  p_geo text,
  p_active boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_query text := trim(coalesce(p_query,''));
  v_geo text := upper(trim(coalesce(p_geo,'')));
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if length(v_query)<2 or length(v_query)>80 then raise exception 'Seed query must have 2-80 characters'; end if;
  if v_geo not in ('','RS') then raise exception 'Unsupported geo'; end if;
  if p_sort_order not between 0 and 10000 then raise exception 'sort_order out of range'; end if;

  if p_id is not null then
    update private.discovery_seed_terms
    set query=v_query,geo=v_geo,active=p_active,sort_order=p_sort_order,updated_at=now()
    where id=p_id
    returning id into v_id;
    if v_id is null then raise exception 'Seed not found'; end if;
  else
    select id into v_id
    from private.discovery_seed_terms
    where geo=v_geo and lower(query)=lower(v_query)
    limit 1;

    if v_id is null then
      insert into private.discovery_seed_terms(geo,query,active,sort_order)
      values(v_geo,v_query,p_active,p_sort_order)
      returning id into v_id;
    else
      update private.discovery_seed_terms
      set active=p_active,sort_order=p_sort_order,updated_at=now()
      where id=v_id;
    end if;
  end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'discovery_seed_upserted','discovery_seed',v_id::text,jsonb_build_object(
    'query',v_query,'geo',v_geo,'active',p_active,'sort_order',p_sort_order
  ));

  return jsonb_build_object('ok',true,'id',v_id);
end;
$function$;

revoke all on function private.admin_upsert_discovery_seed(uuid,text,text,boolean,integer) from public,anon,authenticated;

create or replace function public.admin_upsert_discovery_seed(
  p_id uuid,
  p_query text,
  p_geo text,
  p_active boolean,
  p_sort_order integer
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_upsert_discovery_seed(p_id,p_query,p_geo,p_active,p_sort_order);
$function$;

revoke all on function public.admin_upsert_discovery_seed(uuid,text,text,boolean,integer) from public,anon;
grant execute on function public.admin_upsert_discovery_seed(uuid,text,text,boolean,integer) to authenticated;

create or replace function private.admin_delete_discovery_seed(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_query text;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  delete from private.discovery_seed_terms
  where id=p_id
  returning query into v_query;

  if v_query is null then raise exception 'Seed not found'; end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'discovery_seed_deleted','discovery_seed',p_id::text,jsonb_build_object('query',v_query));

  return jsonb_build_object('ok',true,'id',p_id);
end;
$function$;

revoke all on function private.admin_delete_discovery_seed(uuid) from public,anon,authenticated;

create or replace function public.admin_delete_discovery_seed(p_id uuid)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_delete_discovery_seed(p_id);
$function$;

revoke all on function public.admin_delete_discovery_seed(uuid) from public,anon;
grant execute on function public.admin_delete_discovery_seed(uuid) to authenticated;

create or replace function public.service_discovery_engine_runtime()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_settings record;
  v_seeds jsonb;
begin
  if current_user <> 'service_role' then raise exception 'Forbidden'; end if;

  select * into v_settings
  from private.discovery_engine_settings
  where id=1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'geo',geo,'query',query,'sort_order',sort_order
  ) order by sort_order,geo,query),'[]'::jsonb)
  into v_seeds
  from (
    select *
    from private.discovery_seed_terms
    where active
    order by sort_order,geo,query
    limit v_settings.candidate_seed_limit
  ) s;

  return jsonb_build_object(
    'provider_enabled',v_settings.provider_enabled,
    'per_sync_call_limit',v_settings.per_sync_call_limit,
    'daily_call_limit',v_settings.daily_call_limit,
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'candidate_seed_limit',v_settings.candidate_seed_limit,
    'seeds',v_seeds
  );
end;
$function$;

revoke all on function public.service_discovery_engine_runtime() from public,anon,authenticated;
grant execute on function public.service_discovery_engine_runtime() to service_role;
