
create or replace function public.admin_set_discovery_provider_key(p_key text)
returns boolean
language sql
set search_path to ''
as $function$
  select private.admin_set_discovery_provider_key(p_key);
$function$;

create or replace function public.admin_discovery_provider_status()
returns jsonb
language sql
set search_path to ''
as $function$
  select private.admin_discovery_provider_status();
$function$;

create or replace function private.admin_refresh_discovery_learning()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  return private.refresh_discovery_performance_learning();
end;
$function$;

revoke all on function private.admin_refresh_discovery_learning() from public,anon;
grant execute on function private.admin_refresh_discovery_learning() to authenticated;

create or replace function public.admin_refresh_discovery_learning()
returns jsonb
language sql
set search_path to ''
as $function$
  select private.admin_refresh_discovery_learning();
$function$;

revoke all on function public.admin_set_discovery_provider_key(text) from public,anon;
grant execute on function public.admin_set_discovery_provider_key(text) to authenticated;

revoke all on function public.admin_discovery_provider_status() from public,anon;
grant execute on function public.admin_discovery_provider_status() to authenticated;

revoke all on function public.admin_refresh_discovery_learning() from public,anon;
grant execute on function public.admin_refresh_discovery_learning() to authenticated;
