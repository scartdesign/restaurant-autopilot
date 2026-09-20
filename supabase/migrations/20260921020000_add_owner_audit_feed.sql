create or replace function private.admin_owner_audit_feed(p_limit integer default 80)
returns table(
  id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  return query
  select
    a.id::text,
    a.actor_user_id,
    a.action,
    a.entity_type,
    a.entity_id::text,
    coalesce(a.details,'{}'::jsonb),
    a.created_at
  from public.admin_audit_log a
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,80),200));
end;
$function$;

revoke all on function private.admin_owner_audit_feed(integer) from public,anon;
grant execute on function private.admin_owner_audit_feed(integer) to authenticated;

create or replace function public.admin_owner_audit_feed(p_limit integer default 80)
returns table(
  id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz
)
language sql
security invoker
set search_path to ''
as $function$
  select * from private.admin_owner_audit_feed(p_limit);
$function$;

revoke all on function public.admin_owner_audit_feed(integer) from public,anon;
grant execute on function public.admin_owner_audit_feed(integer) to authenticated;
