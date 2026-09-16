alter table public.sales_orders
  add column if not exists payment_provider text,
  add column if not exists provider_checkout_session_id text,
  add column if not exists provider_payment_intent_id text,
  add column if not exists provider_payment_status text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create unique index if not exists sales_orders_provider_checkout_session_uidx
on public.sales_orders(provider_checkout_session_id)
where provider_checkout_session_id is not null;

create index if not exists sales_orders_provider_payment_intent_idx
on public.sales_orders(provider_payment_intent_id)
where provider_payment_intent_id is not null;

create table if not exists public.payment_webhook_events(
  id text primary key,
  provider text not null check(provider in ('stripe')),
  event_type text not null,
  order_id uuid references public.sales_orders(id) on delete set null,
  status text not null default 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payment_webhook_events enable row level security;
revoke all on table public.payment_webhook_events from anon,authenticated;
create index if not exists payment_webhook_events_order_idx on public.payment_webhook_events(order_id,created_at desc);

create or replace function private.admin_stripe_provider_status()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_key boolean; v_webhook boolean;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_secret_key') into v_key;
  select exists(select 1 from vault.secrets where name='restaurant_autopilot_stripe_webhook_secret') into v_webhook;
  return jsonb_build_object('configured',v_key and v_webhook,'secret_key',v_key,'webhook_secret',v_webhook,'provider','stripe');
end;
$function$;

revoke all on function private.admin_stripe_provider_status() from public,anon;
grant execute on function private.admin_stripe_provider_status() to authenticated;

create or replace function public.admin_stripe_provider_status()
returns jsonb
language sql
set search_path to ''
as $function$ select private.admin_stripe_provider_status(); $function$;

revoke all on function public.admin_stripe_provider_status() from public,anon;
grant execute on function public.admin_stripe_provider_status() to authenticated;

create or replace function private.admin_set_stripe_provider(p_secret_key text,p_webhook_secret text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_key text:=trim(coalesce(p_secret_key,''));
  v_webhook text:=trim(coalesce(p_webhook_secret,''));
  v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_key !~ '^sk_(test|live)_' or length(v_key)<20 then raise exception 'Stripe Secret Key nije validan'; end if;
  if v_webhook !~ '^whsec_' or length(v_webhook)<20 then raise exception 'Stripe Webhook Secret nije validan'; end if;

  select id into v_id from vault.secrets where name='restaurant_autopilot_stripe_secret_key' order by updated_at desc limit 1;
  if v_id is null then
    perform vault.create_secret(v_key,'restaurant_autopilot_stripe_secret_key','Restaurant Autopilot Stripe secret key');
  else
    perform vault.update_secret(v_id,v_key,'restaurant_autopilot_stripe_secret_key','Restaurant Autopilot Stripe secret key');
  end if;

  v_id:=null;
  select id into v_id from vault.secrets where name='restaurant_autopilot_stripe_webhook_secret' order by updated_at desc limit 1;
  if v_id is null then
    perform vault.create_secret(v_webhook,'restaurant_autopilot_stripe_webhook_secret','Restaurant Autopilot Stripe webhook signing secret');
  else
    perform vault.update_secret(v_id,v_webhook,'restaurant_autopilot_stripe_webhook_secret','Restaurant Autopilot Stripe webhook signing secret');
  end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'stripe_provider_updated','system',null,jsonb_build_object('provider','stripe'));
  return true;
end;
$function$;

revoke all on function private.admin_set_stripe_provider(text,text) from public,anon;
grant execute on function private.admin_set_stripe_provider(text,text) to authenticated;

create or replace function public.admin_set_stripe_provider(p_secret_key text,p_webhook_secret text)
returns boolean
language sql
set search_path to ''
as $function$ select private.admin_set_stripe_provider(p_secret_key,p_webhook_secret); $function$;

revoke all on function public.admin_set_stripe_provider(text,text) from public,anon;
grant execute on function public.admin_set_stripe_provider(text,text) to authenticated;

create or replace function public.service_stripe_config()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_key text; v_webhook text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name='restaurant_autopilot_stripe_secret_key' order by updated_at desc limit 1;
  select decrypted_secret into v_webhook from vault.decrypted_secrets where name='restaurant_autopilot_stripe_webhook_secret' order by updated_at desc limit 1;
  return jsonb_build_object('configured',v_key is not null and v_webhook is not null,'secret_key',v_key,'webhook_secret',v_webhook);
end;
$function$;

revoke all on function public.service_stripe_config() from public,anon,authenticated;
grant execute on function public.service_stripe_config() to service_role;

create or replace function public.service_mark_stripe_order_paid(
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text default null,
  p_payment_status text default 'paid'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.sales_orders%rowtype;
  v_plan public.sales_plans%rowtype;
  v_sub public.customer_subscriptions%rowtype;
  v_promo public.promo_codes%rowtype;
begin
  select * into v_order from public.sales_orders where id=p_order_id for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  if v_order.payment_method<>'card' then raise exception 'Order is not a card order'; end if;
  if v_order.status in ('cancelled','refunded') then raise exception 'Order cannot be activated'; end if;

  if v_order.subscription_id is not null or v_order.status='paid' then
    return jsonb_build_object('ok',true,'already_active',true,'subscription_id',v_order.subscription_id);
  end if;

  if v_order.promo_code_id is not null then
    select * into v_promo from public.promo_codes where id=v_order.promo_code_id for update;
    if v_promo.id is null or not v_promo.active then raise exception 'Promo kod više nije aktivan'; end if;
    if v_promo.max_uses is not null and v_promo.use_count>=v_promo.max_uses then raise exception 'Promo kod je dostigao limit korišćenja'; end if;
  end if;

  select * into v_plan from public.sales_plans where id=v_order.plan_id;
  if v_plan.id is null then raise exception 'Plan not found'; end if;

  v_sub:=private.activate_plan_for_user(
    v_order.user_id,
    v_plan.id,
    v_order.payment_method,
    coalesce(nullif(p_payment_intent_id,''),nullif(p_checkout_session_id,''),v_order.order_number),
    null,
    null,
    'Stripe payment confirmed'
  );

  update public.sales_orders
  set status='paid',
      paid_at=now(),
      subscription_id=v_sub.id,
      payment_provider='stripe',
      provider_checkout_session_id=coalesce(nullif(p_checkout_session_id,''),provider_checkout_session_id),
      provider_payment_intent_id=coalesce(nullif(p_payment_intent_id,''),provider_payment_intent_id),
      provider_payment_status=coalesce(nullif(p_payment_status,''),'paid'),
      admin_note=coalesce(admin_note,'Stripe payment confirmed'),
      updated_at=now()
  where id=v_order.id;

  if v_promo.id is not null then
    update public.promo_codes set use_count=use_count+1,updated_at=now() where id=v_promo.id;
  end if;

  perform private.audit_event(
    'order_paid','sales_order',v_order.id::text,
    jsonb_build_object('order_number',v_order.order_number,'user_id',v_order.user_id,'amount',v_order.amount,'currency',v_order.currency,'plan',v_plan.code,'subscription_id',v_sub.id,'provider','stripe','checkout_session_id',p_checkout_session_id,'payment_intent_id',p_payment_intent_id)
  );
  perform private.queue_notice(
    v_order.user_id,'order_paid','Uplata potvrđena',
    'Kartična uplata za '||v_plan.name||' je potvrđena. Restaurant Autopilot je aktivan.',
    jsonb_build_object('order_id',v_order.id,'subscription_id',v_sub.id,'provider','stripe')
  );

  return jsonb_build_object('ok',true,'already_active',false,'subscription_id',v_sub.id);
end;
$function$;

revoke all on function public.service_mark_stripe_order_paid(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.service_mark_stripe_order_paid(uuid,text,text,text) to service_role;
