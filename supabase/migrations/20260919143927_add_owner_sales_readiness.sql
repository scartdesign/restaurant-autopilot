create or replace function private.admin_sales_readiness()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  s public.sales_settings%rowtype;
  v_stripe_secret boolean:=false;
  v_stripe_webhook boolean:=false;
  v_seller_ready boolean:=false;
  v_bank_ready boolean:=false;
  v_paypal_ready boolean:=false;
  v_card_ready boolean:=false;
  v_invoice_ready boolean:=false;
  v_any_payment boolean:=false;
  v_blockers jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select * into s from public.sales_settings where id=1;
  if not found then raise exception 'Sales settings not found'; end if;

  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_secret_key') into v_stripe_secret;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_webhook_secret') into v_stripe_webhook;

  v_seller_ready :=
    nullif(trim(coalesce(s.legal_name,s.company_name,'')),'') is not null
    and nullif(trim(coalesce(s.address,'')),'') is not null
    and nullif(trim(coalesce(s.tax_id,'')),'') is not null;

  v_bank_ready :=
    coalesce(s.allow_bank_transfer,false)
    and (
      nullif(trim(coalesce(s.bank_account,'')),'') is not null
      or nullif(trim(coalesce(s.bank_instructions,'')),'') is not null
    );

  v_paypal_ready :=
    coalesce(s.allow_paypal,false)
    and nullif(trim(coalesce(s.paypal_url,'')),'') is not null;

  v_card_ready :=
    coalesce(s.allow_card,false)
    and v_stripe_secret
    and v_stripe_webhook;

  v_invoice_ready := coalesce(s.allow_invoice,false) and v_seller_ready;
  v_any_payment := v_bank_ready or v_paypal_ready or v_card_ready or v_invoice_ready;

  select coalesce(jsonb_agg(step),'[]'::jsonb)
  into v_blockers
  from (
    values
      (case when not v_seller_ready then 'Dopuni pravne podatke prodavca: naziv, adresa i PIB'::text else null end),
      (case when coalesce(s.allow_bank_transfer,false) and not v_bank_ready then 'Unesi račun ili instrukcije za uplatu na račun'::text else null end),
      (case when coalesce(s.allow_card,false) and not v_card_ready then 'Podesi Stripe secret + webhook secret'::text else null end),
      (case when coalesce(s.allow_paypal,false) and not v_paypal_ready then 'Unesi PayPal payment URL'::text else null end),
      (case when not v_any_payment then 'Aktiviraj bar jedan potpuno konfigurisan kanal naplate'::text else null end)
  ) x(step)
  where step is not null;

  return jsonb_build_object(
    'seller_profile_ready',v_seller_ready,
    'bank_transfer_ready',v_bank_ready,
    'paypal_ready',v_paypal_ready,
    'card_ready',v_card_ready,
    'invoice_ready',v_invoice_ready,
    'trial_enabled',coalesce(s.trial_enabled,false),
    'any_payment_ready',v_any_payment,
    'sales_email_ready',nullif(trim(coalesce(s.sales_email,'')),'') is not null,
    'legal_links_ready',nullif(trim(coalesce(s.terms_url,'')),'') is not null and nullif(trim(coalesce(s.privacy_url,'')),'') is not null,
    'blockers',v_blockers,
    'generated_at',now()
  );
end;
$function$;

create or replace function public.admin_sales_readiness()
returns jsonb
language sql
security definer
set search_path=''
as $function$
  select private.admin_sales_readiness();
$function$;

revoke all on function public.admin_sales_readiness() from public,anon;
grant execute on function public.admin_sales_readiness() to authenticated;
