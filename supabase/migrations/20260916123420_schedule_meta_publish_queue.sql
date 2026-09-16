do $block$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.secrets
  where name='restaurant_autopilot_meta_publish_cron'
  order by updated_at desc
  limit 1;
  if v_id is null then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      'restaurant_autopilot_meta_publish_cron',
      'Restaurant Autopilot Meta publish queue cron secret'
    );
  end if;
end;
$block$;

create or replace function public.service_publish_cron_secret()
returns text
language sql
security definer
set search_path to ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='restaurant_autopilot_meta_publish_cron'
  order by updated_at desc
  limit 1;
$function$;

revoke all on function public.service_publish_cron_secret() from public, anon, authenticated;
grant execute on function public.service_publish_cron_secret() to service_role;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-meta-publish');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-meta-publish',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/meta-publisher',
      body := '{"action":"process_queue"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='restaurant_autopilot_meta_publish_cron'
          order by updated_at desc
          limit 1
        )
      ),
      timeout_milliseconds := 20000
    );
  $cron$
);
