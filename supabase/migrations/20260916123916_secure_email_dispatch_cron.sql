do $block$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.secrets
  where name='restaurant_autopilot_email_cron'
  order by updated_at desc
  limit 1;
  if v_id is null then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      'restaurant_autopilot_email_cron',
      'Restaurant Autopilot email dispatch cron secret'
    );
  end if;
end;
$block$;

create or replace function public.service_email_cron_secret()
returns text
language sql
security definer
set search_path to ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='restaurant_autopilot_email_cron'
  order by updated_at desc
  limit 1;
$function$;

revoke all on function public.service_email_cron_secret() from public, anon, authenticated;
grant execute on function public.service_email_cron_secret() to service_role;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-email-dispatch');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-email-dispatch',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/email-dispatch',
      body := '{"action":"cron_send_queue","limit":25}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='restaurant_autopilot_email_cron'
          order by updated_at desc
          limit 1
        )
      ),
      timeout_milliseconds := 20000
    );
  $cron$
);
