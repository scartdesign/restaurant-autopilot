
alter table private.discovery_engine_settings
  add column if not exists auto_profile_seeds_enabled boolean not null default true;

create or replace function private.discovery_auto_seed_suggestions(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with raw as (
    select
      case
        when lower(coalesce(r.country,'')) like '%serb%'
          or lower(coalesce(r.country,'')) like '%srb%'
          or coalesce(r.country,'')=''
        then 'RS' else ''
      end as geo,
      trim(r.cuisine_type) as query,
      'cuisine'::text as source
    from public.restaurants r
    where r.cuisine_type is not null
      and length(trim(r.cuisine_type)) between 2 and 40

    union all

    select
      case
        when lower(coalesce(r.country,'')) like '%serb%'
          or lower(coalesce(r.country,'')) like '%srb%'
          or coalesce(r.country,'')=''
        then 'RS' else ''
      end as geo,
      trim(m.category) as query,
      'menu_category'::text as source
    from public.menu_items m
    join public.restaurants r on r.id=m.restaurant_id
    where m.is_active
      and m.category is not null
      and length(trim(m.category)) between 2 and 40
  ),
  filtered as (
    select *
    from raw
    where lower(query) not in (
      'ostalo','other','ostala jela','jela','food','hrana',
      'piće','pice','drinks','napici','menu','meni'
    )
      and query !~ '[[:cntrl:]]'
  ),
  grouped as (
    select
      geo,
      lower(query) as query_key,
      min(query) as query,
      count(*)::integer as usage_count,
      min(source) as source
    from filtered
    group by geo,lower(query)
  ),
  ranked as (
    select *
    from grouped
    order by usage_count desc,query_key
    limit greatest(0,least(coalesce(p_limit,12),30))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'geo',geo,
    'query',query,
    'usage_count',usage_count,
    'source',source
  ) order by usage_count desc,query),'[]'::jsonb)
  from ranked;
$function$;

revoke all on function private.discovery_auto_seed_suggestions(integer) from public,anon,authenticated;

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
    'auto_profile_seeds_enabled',v_settings.auto_profile_seeds_enabled,
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'updated_at',v_settings.updated_at,
    'seeds',v_seeds,
    'auto_seed_suggestions',private.discovery_auto_seed_suggestions(12)
  );
end;
$function$;

revoke all on function private.admin_discovery_engine_config() from public,anon,authenticated;

create or replace function private.admin_set_discovery_auto_seeds(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  update private.discovery_engine_settings
  set auto_profile_seeds_enabled=p_enabled,
      updated_at=now(),
      updated_by=auth.uid()
  where id=1;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'discovery_auto_seeds_updated','discovery_engine','1',jsonb_build_object('enabled',p_enabled));

  return private.admin_discovery_engine_config();
end;
$function$;

revoke all on function private.admin_set_discovery_auto_seeds(boolean) from public,anon,authenticated;

create or replace function public.admin_set_discovery_auto_seeds(p_enabled boolean)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_set_discovery_auto_seeds(p_enabled);
$function$;

revoke all on function public.admin_set_discovery_auto_seeds(boolean) from public,anon;
grant execute on function public.admin_set_discovery_auto_seeds(boolean) to authenticated;

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
    'auto_profile_seeds_enabled',v_settings.auto_profile_seeds_enabled,
    'seeds',v_seeds,
    'auto_seeds',case
      when v_settings.auto_profile_seeds_enabled
      then private.discovery_auto_seed_suggestions(v_settings.candidate_seed_limit)
      else '[]'::jsonb
    end
  );
end;
$function$;

revoke all on function public.service_discovery_engine_runtime() from public,anon,authenticated;
grant execute on function public.service_discovery_engine_runtime() to service_role;
