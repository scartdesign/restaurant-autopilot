
create or replace function private.admin_discovery_sync_feed(p_limit integer default 20)
returns table(
  id uuid,
  source text,
  mode text,
  status text,
  terms_seen integer,
  terms_updated integer,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  metadata jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  return query
  select
    r.id,
    r.source,
    r.mode,
    r.status,
    r.terms_seen,
    r.terms_updated,
    r.started_at,
    r.finished_at,
    r.error_message,
    r.metadata
  from private.discovery_sync_runs r
  order by r.started_at desc
  limit greatest(1,least(coalesce(p_limit,20),100));
end;
$function$;

revoke all on function private.admin_discovery_sync_feed(integer) from public,anon;
grant execute on function private.admin_discovery_sync_feed(integer) to authenticated;

create or replace function public.admin_discovery_sync_feed(p_limit integer default 20)
returns table(
  id uuid,
  source text,
  mode text,
  status text,
  terms_seen integer,
  terms_updated integer,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  metadata jsonb
)
language sql
set search_path to ''
as $function$
  select * from private.admin_discovery_sync_feed(p_limit);
$function$;

revoke all on function public.admin_discovery_sync_feed(integer) from public,anon;
grant execute on function public.admin_discovery_sync_feed(integer) to authenticated;
