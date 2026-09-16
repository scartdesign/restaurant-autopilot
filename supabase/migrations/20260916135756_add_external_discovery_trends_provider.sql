
alter table public.discovery_terms
  add column if not exists external_trend_score integer not null default 50,
  add column if not exists external_source text,
  add column if not exists external_verified_at timestamptz,
  add column if not exists external_trend_meta jsonb not null default '{}'::jsonb;

do $block$
begin
  alter table public.discovery_terms
    add constraint discovery_terms_external_trend_score_check check (external_trend_score between 0 and 100);
exception when duplicate_object then null;
end;
$block$;

create index if not exists discovery_terms_external_trend_idx
  on public.discovery_terms (external_trend_score desc, external_verified_at desc)
  where active;

do $block$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.secrets
  where name='restaurant_autopilot_discovery_cron'
  order by updated_at desc
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      'restaurant_autopilot_discovery_cron',
      'Restaurant Autopilot Discovery sync cron secret'
    );
  end if;
end;
$block$;

create or replace function private.admin_set_discovery_provider_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_key text := trim(coalesce(p_key,''));
  v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if length(v_key) < 20 then raise exception 'SerpApi ključ nije validnog formata'; end if;

  select id into v_id
  from vault.secrets
  where name='restaurant_autopilot_serpapi'
  order by updated_at desc
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      v_key,
      'restaurant_autopilot_serpapi',
      'Restaurant Autopilot SerpApi Google Trends key'
    );
  else
    perform vault.update_secret(
      v_id,
      v_key,
      'restaurant_autopilot_serpapi',
      'Restaurant Autopilot SerpApi Google Trends key'
    );
  end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'discovery_provider_updated',
    'system',
    null,
    jsonb_build_object('provider','serpapi_google_trends')
  );

  return true;
end;
$function$;

revoke all on function private.admin_set_discovery_provider_key(text) from public,anon;
grant execute on function private.admin_set_discovery_provider_key(text) to authenticated;

create or replace function public.admin_set_discovery_provider_key(p_key text)
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select private.admin_set_discovery_provider_key(p_key);
$function$;

revoke all on function public.admin_set_discovery_provider_key(text) from public,anon;
grant execute on function public.admin_set_discovery_provider_key(text) to authenticated;

create or replace function private.admin_discovery_provider_status()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_configured boolean;
  v_latest timestamptz;
  v_terms integer;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select exists(
    select 1 from vault.secrets
    where name='restaurant_autopilot_serpapi'
  ) into v_configured;

  select max(external_verified_at),count(*) filter(where external_verified_at is not null)::integer
  into v_latest,v_terms
  from public.discovery_terms
  where active;

  return jsonb_build_object(
    'configured',v_configured,
    'provider','serpapi_google_trends',
    'last_sync_at',v_latest,
    'verified_terms',coalesce(v_terms,0)
  );
end;
$function$;

revoke all on function private.admin_discovery_provider_status() from public,anon;
grant execute on function private.admin_discovery_provider_status() to authenticated;

create or replace function public.admin_discovery_provider_status()
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select private.admin_discovery_provider_status();
$function$;

revoke all on function public.admin_discovery_provider_status() from public,anon;
grant execute on function public.admin_discovery_provider_status() to authenticated;

create or replace function public.service_discovery_provider_config()
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'configured',exists(
      select 1 from vault.secrets
      where name='restaurant_autopilot_serpapi'
    ),
    'api_key',(
      select decrypted_secret
      from vault.decrypted_secrets
      where name='restaurant_autopilot_serpapi'
      order by updated_at desc
      limit 1
    ),
    'cron_secret',(
      select decrypted_secret
      from vault.decrypted_secrets
      where name='restaurant_autopilot_discovery_cron'
      order by updated_at desc
      limit 1
    ),
    'provider','serpapi_google_trends'
  );
$function$;

revoke all on function public.service_discovery_provider_config() from public,anon,authenticated;
grant execute on function public.service_discovery_provider_config() to service_role;

create or replace function private.admin_discovery_health()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer := 0;
  v_active integer := 0;
  v_stale_7d integer := 0;
  v_stale_30d integer := 0;
  v_latest timestamptz;
  v_oldest timestamptz;
  v_sources jsonb := '{}'::jsonb;
  v_platforms jsonb := '{}'::jsonb;
  v_categories jsonb := '{}'::jsonb;
  v_performance_samples integer := 0;
  v_performance_restaurants integer := 0;
  v_learned_terms integer := 0;
  v_learning_samples integer := 0;
  v_last_learned_at timestamptz;
  v_provider_configured boolean := false;
  v_external_terms integer := 0;
  v_external_latest timestamptz;
  v_last_run jsonb;
  v_last_learning_run jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select
    count(*)::integer,
    count(*) filter (where active)::integer,
    count(*) filter (where active and last_verified_at < now() - interval '7 days')::integer,
    count(*) filter (where active and last_verified_at < now() - interval '30 days')::integer,
    max(last_verified_at) filter (where active),
    min(last_verified_at) filter (where active),
    count(*) filter (where active and performance_sample_count > 0)::integer,
    coalesce(sum(performance_sample_count) filter (where active),0)::integer,
    max(last_learned_at) filter (where active),
    count(*) filter (where active and external_verified_at is not null)::integer,
    max(external_verified_at) filter (where active)
  into v_total,v_active,v_stale_7d,v_stale_30d,v_latest,v_oldest,
       v_learned_terms,v_learning_samples,v_last_learned_at,
       v_external_terms,v_external_latest
  from public.discovery_terms;

  select exists(
    select 1 from vault.secrets
    where name='restaurant_autopilot_serpapi'
  ) into v_provider_configured;

  select coalesce(jsonb_object_agg(source,cnt order by source),'{}'::jsonb)
  into v_sources
  from (
    select source,count(*)::integer cnt
    from public.discovery_terms
    where active
    group by source
  ) s;

  select coalesce(jsonb_object_agg(platform,cnt order by platform),'{}'::jsonb)
  into v_platforms
  from (
    select platform,count(*)::integer cnt
    from public.discovery_terms
    where active
    group by platform
  ) p;

  select coalesce(jsonb_object_agg(category,cnt order by category),'{}'::jsonb)
  into v_categories
  from (
    select category,count(*)::integer cnt
    from public.discovery_terms
    where active
    group by category
  ) c;

  select count(*)::integer,count(distinct restaurant_id)::integer
  into v_performance_samples,v_performance_restaurants
  from public.post_performance;

  select to_jsonb(r) into v_last_run
  from (
    select id,source,mode,status,terms_seen,terms_inserted,terms_updated,
           terms_deactivated,started_at,finished_at,error_message,metadata
    from private.discovery_sync_runs
    order by started_at desc
    limit 1
  ) r;

  select to_jsonb(r) into v_last_learning_run
  from (
    select id,source,mode,status,terms_seen,terms_inserted,terms_updated,
           terms_deactivated,started_at,finished_at,error_message,metadata
    from private.discovery_sync_runs
    where mode='performance_learning'
    order by started_at desc
    limit 1
  ) r;

  return jsonb_build_object(
    'mode','external_trends_plus_performance_learning',
    'live_search_volume',v_provider_configured,
    'external_provider_configured',v_provider_configured,
    'external_provider','serpapi_google_trends',
    'external_terms',v_external_terms,
    'external_latest_at',v_external_latest,
    'total_terms',v_total,
    'active_terms',v_active,
    'stale_7d',v_stale_7d,
    'stale_30d',v_stale_30d,
    'latest_verified_at',v_latest,
    'oldest_verified_at',v_oldest,
    'sources',v_sources,
    'platforms',v_platforms,
    'categories',v_categories,
    'performance_samples',v_performance_samples,
    'performance_restaurants',v_performance_restaurants,
    'learned_terms',v_learned_terms,
    'learning_samples',v_learning_samples,
    'last_learned_at',v_last_learned_at,
    'last_sync_run',v_last_run,
    'last_learning_run',v_last_learning_run
  );
end;
$function$;

create or replace function public.rank_post_discovery_from_bank()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.restaurants%rowtype;
  m public.menu_items%rowtype;
  cuisine_key text;
  dish_key text;
  local_ig text[] := '{}'::text[];
  topic_ig text[] := '{}'::text[];
  broad_ig text[] := '{}'::text[];
  local_fb text[] := '{}'::text[];
  topic_fb text[] := '{}'::text[];
  candidate_ig text[] := '{}'::text[];
  candidate_fb text[] := '{}'::text[];
  ranked_ig text[] := '{}'::text[];
  ranked_fb text[] := '{}'::text[];
  verified_at timestamptz;
  learned_at timestamptz;
  external_at timestamptz;
  bank_bonus integer := 0;
begin
  select * into r from public.restaurants where id=new.restaurant_id;
  if not found then return new; end if;

  if new.menu_item_id is not null then
    select * into m from public.menu_items where id=new.menu_item_id;
  end if;

  cuisine_key := case
    when lower(coalesce(r.cuisine_type,'')) like '%ital%' then 'italian'
    when lower(coalesce(r.cuisine_type,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(r.cuisine_type,'')) like '%burger%' or lower(coalesce(r.cuisine_type,'')) like '%fast%' then 'fast_food'
    when lower(coalesce(r.cuisine_type,'')) like '%balkan%' or lower(coalesce(r.cuisine_type,'')) like '%srp%' then 'balkan'
    when lower(coalesce(r.cuisine_type,'')) like '%trad%' or lower(coalesce(r.cuisine_type,'')) like '%doma%' then 'traditional'
    else null end;

  dish_key := case
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%pasta%'
      or lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%carbonara%'
      or lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%lasagn%' then 'pasta'
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%burger%' then 'burger'
    else null end;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into local_ig
  from (
    select term,
      popularity_score*0.42 + intent_score*0.50 - competition_score*0.15
      + (performance_score-50)*0.22 + (external_trend_score-50)*0.20 as weighted_score
    from public.discovery_terms
    where active and platform='instagram' and category='local'
      and (
        lower(coalesce(city,''))=lower(coalesce(r.city,''))
        or lower(coalesce(city,''))=lower(coalesce(r.neighborhood,''))
      )
    order by weighted_score desc
    limit 3
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into topic_ig
  from (
    select term,
      popularity_score*0.42 + intent_score*0.50 - competition_score*0.15
      + (performance_score-50)*0.22 + (external_trend_score-50)*0.20 as weighted_score
    from public.discovery_terms
    where active and platform='instagram'
      and (
        (cuisine_key is not null and cuisine=cuisine_key)
        or (dish_key is not null and cuisine=dish_key)
      )
    order by weighted_score desc
    limit 3
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into broad_ig
  from (
    select term,
      popularity_score*0.32 + intent_score*0.58 - competition_score*0.22
      + (performance_score-50)*0.18 + (external_trend_score-50)*0.18 as weighted_score
    from public.discovery_terms
    where active and platform='instagram' and category='broad'
    order by weighted_score desc
    limit 1
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into local_fb
  from (
    select term,
      popularity_score*0.30 + intent_score*0.60 - competition_score*0.20
      + (performance_score-50)*0.25 + (external_trend_score-50)*0.20 as weighted_score
    from public.discovery_terms
    where active and platform='facebook' and category='local'
      and (
        lower(coalesce(city,''))=lower(coalesce(r.city,''))
        or lower(coalesce(city,''))=lower(coalesce(r.neighborhood,''))
      )
    order by weighted_score desc
    limit 2
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into topic_fb
  from (
    select term,
      popularity_score*0.30 + intent_score*0.60 - competition_score*0.20
      + (performance_score-50)*0.25 + (external_trend_score-50)*0.20 as weighted_score
    from public.discovery_terms
    where active and platform='facebook'
      and (
        (cuisine_key is not null and cuisine=cuisine_key)
        or (dish_key is not null and cuisine=dish_key)
      )
    order by weighted_score desc
    limit 2
  ) q;

  candidate_ig := coalesce(new.hashtags,'{}'::text[]) || local_ig || topic_ig || broad_ig;
  select coalesce(array_agg(term order by first_ord),'{}'::text[])
  into ranked_ig
  from (
    select term,min(ord) first_ord
    from unnest(candidate_ig) with ordinality u(term,ord)
    where term is not null and btrim(term)<>''
    group by term
    order by min(ord)
    limit 8
  ) d;

  candidate_fb := local_fb || topic_fb || coalesce(
    array(select jsonb_array_elements_text(coalesce(new.platform_content->'facebook'->'hashtags','[]'::jsonb))),
    '{}'::text[]
  );

  select coalesce(array_agg(term order by first_ord),'{}'::text[])
  into ranked_fb
  from (
    select term,min(ord) first_ord
    from unnest(candidate_fb) with ordinality u(term,ord)
    where term is not null and btrim(term)<>''
    group by term
    order by min(ord)
    limit 3
  ) d;

  select max(last_verified_at),max(last_learned_at),max(external_verified_at)
  into verified_at,learned_at,external_at
  from public.discovery_terms
  where active;

  bank_bonus := least(
    8,
    coalesce(array_length(local_ig,1),0)*2
    + coalesce(array_length(topic_ig,1),0)
  );

  new.hashtags := ranked_ig;
  new.platform_content := coalesce(new.platform_content,'{}'::jsonb)
    || jsonb_build_object(
      'instagram',coalesce(new.platform_content->'instagram','{}'::jsonb) || jsonb_build_object(
        'hashtags',to_jsonb(ranked_ig),
        'strategy','brand + local intent + cuisine/dish + external trend signal + own performance learning'
      ),
      'facebook',coalesce(new.platform_content->'facebook','{}'::jsonb) || jsonb_build_object(
        'hashtags',to_jsonb(ranked_fb),
        'strategy','high-intent local/cuisine tags + external trend signal + own performance learning'
      )
    );

  new.discovery_score := least(
    99,
    greatest(
      coalesce(new.discovery_score,0),
      72 + bank_bonus
      + case when r.city is not null then 5 else 0 end
      + case when m.image_url is not null then 5 else 0 end
    )
  );

  new.generation_meta := coalesce(new.generation_meta,'{}'::jsonb) || jsonb_build_object(
    'discovery_source','external-trends-learning-v3',
    'discovery_bank_verified_at',verified_at,
    'discovery_learning_at',learned_at,
    'discovery_external_at',external_at,
    'discovery_bank_terms',jsonb_build_object('instagram',ranked_ig,'facebook',ranked_fb)
  );

  return new;
end;
$function$;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-discovery-external');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-discovery-external',
  '10 4 * * *',
  $cron$
    select net.http_post(
      url := 'https://pkbsveezmjkvfuiplrqb.supabase.co/functions/v1/discovery-sync',
      body := '{"action":"process_cron"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='restaurant_autopilot_discovery_cron'
          order by updated_at desc
          limit 1
        )
      ),
      timeout_milliseconds := 45000
    );
  $cron$
);
