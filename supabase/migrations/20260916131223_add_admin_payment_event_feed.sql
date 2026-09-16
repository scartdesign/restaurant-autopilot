create or replace function private.admin_payment_event_feed(p_limit integer default 40)
returns table(
  id text,
  event_type text,
  order_id uuid,
  status text,
  error_message text,
  created_at timestamptz,
  processed_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  return query
  select e.id,e.event_type,e.order_id,e.status,e.error_message,e.created_at,e.processed_at
  from public.payment_webhook_events e
  where e.provider='stripe'
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,40),100));
end;
$function$;

revoke all on function private.admin_payment_event_feed(integer) from public,anon;
grant execute on function private.admin_payment_event_feed(integer) to authenticated;

create or replace function public.admin_payment_event_feed(p_limit integer default 40)
returns table(
  id text,
  event_type text,
  order_id uuid,
  status text,
  error_message text,
  created_at timestamptz,
  processed_at timestamptz
)
language sql
set search_path to ''
as $function$
  select * from private.admin_payment_event_feed(p_limit);
$function$;

revoke all on function public.admin_payment_event_feed(integer) from public,anon;
grant execute on function public.admin_payment_event_feed(integer) to authenticated;
