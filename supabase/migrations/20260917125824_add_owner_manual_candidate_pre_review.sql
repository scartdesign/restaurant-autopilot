create or replace function private.admin_refresh_discovery_candidate_pre_review()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  return private.refresh_discovery_candidate_pre_review();
end;
$function$;

revoke all on function private.admin_refresh_discovery_candidate_pre_review() from public,anon;
grant execute on function private.admin_refresh_discovery_candidate_pre_review() to authenticated;

create or replace function public.admin_refresh_discovery_candidate_pre_review()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_refresh_discovery_candidate_pre_review();
$function$;

revoke all on function public.admin_refresh_discovery_candidate_pre_review() from public,anon;
grant execute on function public.admin_refresh_discovery_candidate_pre_review() to authenticated;
