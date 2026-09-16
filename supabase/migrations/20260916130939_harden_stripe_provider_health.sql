drop policy if exists payment_webhook_events_no_client_access on public.payment_webhook_events;
create policy payment_webhook_events_no_client_access
on public.payment_webhook_events
for all
to authenticated
using(false)
with check(false);

create or replace function private.admin_stripe_provider_status()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_key boolean;
  v_webhook boolean;
  v_failed integer;
  v_pending integer;
  v_paid integer;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_secret_key') into v_key;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_webhook_secret') into v_webhook;
  select count(*)::integer into v_failed from public.payment_webhook_events where provider='stripe' and status='failed';
  select count(*)::integer into v_pending from public.sales_orders where payment_provider='stripe' and status='pending';
  select count(*)::integer into v_paid from public.sales_orders where payment_provider='stripe' and status='paid';

  return jsonb_build_object(
    'configured',v_key and v_webhook,
    'secret_key',v_key,
    'webhook_secret',v_webhook,
    'provider','stripe',
    'failed_webhooks',v_failed,
    'pending_checkouts',v_pending,
    'paid_orders',v_paid
  );
end;
$function$;
