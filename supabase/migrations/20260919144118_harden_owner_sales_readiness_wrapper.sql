create or replace function public.admin_sales_readiness()
returns jsonb
language sql
security invoker
set search_path=''
as $function$
  select private.admin_sales_readiness();
$function$;

revoke all on function public.admin_sales_readiness() from public,anon;
grant execute on function public.admin_sales_readiness() to authenticated;
