CREATE OR REPLACE FUNCTION private.create_sales_order(p_plan_id uuid, p_payment_method text, p_customer_note text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS sales_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_plan public.sales_plans%rowtype;
  v_settings public.sales_settings%rowtype;
  v_profile public.customer_profiles%rowtype;
  v_row public.sales_orders%rowtype;
  v_controls public.app_controls%rowtype;
  v_promo public.promo_codes%rowtype;
  v_original numeric:=0;
  v_discount numeric:=0;
  v_final numeric:=0;
  v_stripe_ready boolean:=false;
  v_seller_ready boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_controls from public.app_controls where id=1;
  if coalesce(v_controls.sales_open,true)=false then raise exception 'Prodaja je trenutno zatvorena'; end if;

  select * into v_plan from public.sales_plans where id=p_plan_id and active and public;
  if v_plan.id is null then raise exception 'Plan is not available'; end if;

  select * into v_settings from public.sales_settings where id=1;
  select * into v_profile from public.customer_profiles where user_id=v_uid;

  if p_payment_method not in ('bank_transfer','paypal','card','invoice') then
    raise exception 'Unsupported payment method';
  end if;

  v_seller_ready :=
    nullif(trim(coalesce(v_settings.legal_name,v_settings.company_name,'')),'') is not null
    and nullif(trim(coalesce(v_settings.address,'')),'') is not null
    and nullif(trim(coalesce(v_settings.tax_id,'')),'') is not null;

  if p_payment_method='bank_transfer' then
    if not coalesce(v_settings.allow_bank_transfer,false) then raise exception 'Bank transfer is disabled'; end if;
    if nullif(trim(coalesce(v_settings.bank_account,'')),'') is null
      and nullif(trim(coalesce(v_settings.bank_instructions,'')),'') is null
    then raise exception 'Bank transfer is not configured'; end if;
  end if;

  if p_payment_method='paypal' then
    if not coalesce(v_settings.allow_paypal,false) then raise exception 'PayPal is disabled'; end if;
    if nullif(trim(coalesce(v_settings.paypal_url,'')),'') is null then raise exception 'PayPal is not configured'; end if;
  end if;

  if p_payment_method='invoice' then
    if not coalesce(v_settings.allow_invoice,false) then raise exception 'Invoice is disabled'; end if;
    if not v_seller_ready then raise exception 'Invoice seller details are not configured'; end if;
  end if;

  if p_payment_method='card' then
    if not coalesce(v_settings.allow_card,false) then raise exception 'Card payment is disabled'; end if;
    select
      exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_secret_key')
      and exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_webhook_secret')
    into v_stripe_ready;
    if not v_stripe_ready then raise exception 'Card payment is not configured'; end if;
  end if;

  if exists(
    select 1 from public.sales_orders
    where user_id=v_uid
      and plan_id=p_plan_id
      and payment_method=p_payment_method
      and status='pending'
      and created_at>now()-interval '30 minutes'
  ) then
    raise exception 'Već postoji skoro kreiran zahtev za ovaj paket';
  end if;

  v_original:=v_plan.price;
  v_final:=v_original;

  if trim(coalesce(p_coupon_code,''))<>'' then
    select * into v_promo
    from public.promo_codes
    where upper(code)=upper(trim(p_coupon_code))
    for update;

    if v_promo.id is null or not v_promo.active then raise exception 'Promo kod nije važeći'; end if;
    if v_promo.starts_at is not null and v_promo.starts_at>now() then raise exception 'Promo kod još nije aktivan'; end if;
    if v_promo.expires_at is not null and v_promo.expires_at<=now() then raise exception 'Promo kod je istekao'; end if;
    if v_promo.plan_id is not null and v_promo.plan_id<>v_plan.id then raise exception 'Promo kod ne važi za ovaj paket'; end if;
    if v_promo.max_uses is not null and v_promo.use_count>=v_promo.max_uses then raise exception 'Promo kod je iskorišćen maksimalan broj puta'; end if;

    if v_promo.discount_type='percent' then
      v_discount:=round(v_original*least(v_promo.discount_value,100)/100,2);
    else
      v_discount:=least(v_original,v_promo.discount_value);
    end if;
    v_final:=greatest(0,v_original-v_discount);
  end if;

  insert into public.sales_orders(
    user_id,plan_id,status,payment_method,amount,original_amount,discount_amount,promo_code_id,currency,
    customer_note,created_by,due_at,billing_snapshot
  )
  values(
    v_uid,v_plan.id,'pending',p_payment_method,v_final,v_original,v_discount,v_promo.id,v_plan.currency,
    nullif(trim(coalesce(p_customer_note,'')),''),
    v_uid,
    now()+make_interval(days=>coalesce(v_settings.order_due_days,5)),
    jsonb_build_object(
      'full_name',v_profile.full_name,
      'phone',v_profile.phone,
      'company',coalesce(v_profile.billing_company,v_profile.company),
      'tax_id',v_profile.billing_tax_id,
      'company_number',v_profile.billing_company_number,
      'address',v_profile.billing_address,
      'city',v_profile.billing_city,
      'country',v_profile.billing_country,
      'promo_code',v_promo.code
    )
  )
  returning * into v_row;

  update public.sales_orders
  set payment_reference=order_number
  where id=v_row.id
  returning * into v_row;

  perform private.queue_notice(
    v_uid,
    'order_created',
    'Narudžbina '||v_row.order_number,
    'Zahtev za paket '||v_plan.name||' je kreiran. Iznos: '||v_row.amount||' '||v_row.currency||'. Poziv na broj: '||v_row.payment_reference||'.',
    jsonb_build_object('order_id',v_row.id,'order_number',v_row.order_number,'discount_amount',v_discount,'promo_code',v_promo.code)
  );

  return v_row;
end;
$function$
;
