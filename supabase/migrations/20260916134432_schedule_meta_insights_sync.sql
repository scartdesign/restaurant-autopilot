alter table public.social_publish_jobs
  add column if not exists insights_synced_at timestamptz,
  add column if not exists insights_error text;

create index if not exists social_publish_jobs_insights_due_idx
  on public.social_publish_jobs (insights_synced_at asc nulls first, published_at desc)
  where status='published' and provider_media_id is not null;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-meta-insights');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-meta-insights',
  '25 */6 * * *',
  $cron$
    select net.http_post(
      url := 'https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/meta-publisher',
      body := '{"action":"process_insights","limit":40}'::jsonb,
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
