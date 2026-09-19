create or replace function private.stripe_live_ready()
returns boolean
language sql
security definer
set search_path=''
as $function$
  select
    coalesce((
      select decrypted_secret like 'sk_live_%'
      from vault.decrypted_secrets
      where name='restaurant_autopilot_stripe_secret_key'
      order by updated_at desc
      limit 1
    ),false)
    and exists(
      select 1
      from vault.decrypted_secrets
      where name='restaurant_autopilot_stripe_webhook_secret'
        and nullif(trim(decrypted_secret),'') is not null
    );
$function$;

revoke all on function private.stripe_live_ready() from public,anon,authenticated;

do $$
declare
  v_def text;
begin
  v_def:=pg_get_functiondef('private.create_sales_order(uuid,text,text,text)'::regprocedure);
  v_def:=replace(
    v_def,
    E'select\n      exists(select 1 from vault.secrets where name=''restaurant_autopilot_stripe_secret_key'')\n      and exists(select 1 from vault.secrets where name=''restaurant_autopilot_stripe_webhook_secret'')\n    into v_stripe_ready;',
    E'v_stripe_ready:=private.stripe_live_ready();'
  );
  if position('v_stripe_ready:=private.stripe_live_ready();' in v_def)=0 then
    raise exception 'Could not harden create_sales_order Stripe readiness';
  end if;
  execute v_def;

  v_def:=pg_get_functiondef('private.admin_sales_readiness()'::regprocedure);
  v_def:=replace(
    v_def,
    E'select exists(select 1 from vault.secrets where name=''restaurant_autopilot_stripe_secret_key'') into v_stripe_secret;\n  select exists(select 1 from vault.secrets where name=''restaurant_autopilot_stripe_webhook_secret'') into v_stripe_webhook;',
    E'v_stripe_secret:=private.stripe_live_ready();\n  v_stripe_webhook:=v_stripe_secret;'
  );
  if position('v_stripe_secret:=private.stripe_live_ready();' in v_def)=0 then
    raise exception 'Could not harden admin_sales_readiness Stripe readiness';
  end if;
  v_def:=replace(v_def,'Podesi Stripe secret + webhook secret','Podesi LIVE Stripe secret + webhook secret');
  execute v_def;
end
$$;
