
alter table public.discovery_terms
  add column if not exists performance_score integer not null default 50,
  add column if not exists performance_sample_count integer not null default 0,
  add column if not exists last_learned_at timestamptz;

do $block$
begin
  alter table public.discovery_terms
    add constraint discovery_terms_performance_score_check check (performance_score between 0 and 100);
exception when duplicate_object then null;
end;
$block$;

do $block$
begin
  alter table public.discovery_terms
    add constraint discovery_terms_performance_sample_count_check check (performance_sample_count >= 0);
exception when duplicate_object then null;
end;
$block$;

create index if not exists discovery_terms_learning_idx
  on public.discovery_terms (platform, performance_score desc, performance_sample_count desc)
  where active;

create or replace function private.refresh_discovery_performance_learning()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_run_id uuid;
  v_learned_terms integer := 0;
  v_total_samples integer := 0;
  v_started_at timestamptz := now();
  v_error text;
begin
  insert into private.discovery_sync_runs(source,mode,status,started_at,metadata)
  values(
    'post_performance',
    'performance_learning',
    'started',
    v_started_at,
    jsonb_build_object('window_days',180,'method','relative_action_rate_shrunk_v1')
  )
  returning id into v_run_id;

  update public.discovery_terms
  set performance_score=50,
      performance_sample_count=0,
      last_learned_at=v_started_at,
      updated_at=v_started_at
  where active;

  with term_perf as (
    select
      pf.platform,
      term.value as term,
      count(*)::integer as samples,
      sum(greatest(pf.reach,0))::numeric as total_reach,
      sum(
        greatest(pf.likes,0)
        + greatest(pf.comments,0) * 1.25
        + greatest(pf.saves,0) * 2.25
        + greatest(pf.shares,0) * 2.50
        + greatest(pf.clicks,0) * 1.50
        + greatest(pf.conversions,0) * 5.00
      )::numeric as weighted_actions
    from public.post_performance pf
    join public.posts p on p.id=pf.post_id and p.restaurant_id=pf.restaurant_id
    cross join lateral jsonb_array_elements_text(
      coalesce(p.generation_meta->'discovery_bank_terms'->pf.platform,'[]'::jsonb)
    ) as term(value)
    where pf.platform in ('instagram','facebook')
      and pf.measured_at >= now() - interval '180 days'
      and pf.reach > 0
      and btrim(term.value) <> ''
    group by pf.platform,term.value
  ),
  ranked as (
    select
      platform,
      term,
      samples,
      weighted_actions / greatest(total_reach,1) as action_rate,
      percent_rank() over(
        partition by platform
        order by weighted_actions / greatest(total_reach,1)
      ) as relative_rank
    from term_perf
  ),
  scored as (
    select
      platform,
      term,
      samples,
      least(
        100,
        greatest(
          0,
          round(
            50
            + ((relative_rank * 100) - 50)
              * least(samples::numeric / 8.0,1.0)
          )
        )
      )::integer as performance_score
    from ranked
  ),
  updated as (
    update public.discovery_terms d
    set performance_score=s.performance_score,
        performance_sample_count=s.samples,
        last_learned_at=v_started_at,
        updated_at=v_started_at
    from scored s
    where d.active
      and d.platform=s.platform
      and lower(d.term)=lower(s.term)
    returning d.id,d.performance_sample_count
  )
  select count(*)::integer,coalesce(sum(performance_sample_count),0)::integer
  into v_learned_terms,v_total_samples
  from updated;

  update private.discovery_sync_runs
  set status='success',
      terms_seen=v_learned_terms,
      terms_updated=v_learned_terms,
      finished_at=now(),
      metadata=metadata || jsonb_build_object(
        'learned_terms',v_learned_terms,
        'term_observations',v_total_samples
      )
  where id=v_run_id;

  return jsonb_build_object(
    'ok',true,
    'learned_terms',v_learned_terms,
    'term_observations',v_total_samples,
    'window_days',180,
    'finished_at',now()
  );
exception when others then
  v_error := left(sqlerrm,1000);
  if v_run_id is not null then
    update private.discovery_sync_runs
    set status='failed',finished_at=now(),error_message=v_error
    where id=v_run_id;
  end if;
  return jsonb_build_object('ok',false,'error',v_error,'finished_at',now());
end;
$function$;

revoke all on function private.refresh_discovery_performance_learning() from public,anon,authenticated;

create or replace function public.admin_refresh_discovery_learning()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  return private.refresh_discovery_performance_learning();
end;
$function$;

revoke all on function public.admin_refresh_discovery_learning() from public,anon;
grant execute on function public.admin_refresh_discovery_learning() to authenticated;

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
    max(last_learned_at) filter (where active)
  into v_total,v_active,v_stale_7d,v_stale_30d,v_latest,v_oldest,
       v_learned_terms,v_learning_samples,v_last_learned_at
  from public.discovery_terms;

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
    'mode','curated_weighted_bank_plus_performance_learning',
    'live_search_volume',false,
    'external_provider_configured',false,
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
  bank_bonus integer := 0;
begin
  select * into r from public.restaurants where id = new.restaurant_id;
  if not found then return new; end if;

  if new.menu_item_id is not null then
    select * into m from public.menu_items where id = new.menu_item_id;
  end if;

  cuisine_key := case
    when lower(coalesce(r.cuisine_type,'')) like '%ital%' then 'italian'
    when lower(coalesce(r.cuisine_type,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(r.cuisine_type,'')) like '%burger%' or lower(coalesce(r.cuisine_type,'')) like '%fast%' then 'fast_food'
    when lower(coalesce(r.cuisine_type,'')) like '%balkan%' or lower(coalesce(r.cuisine_type,'')) like '%srp%' then 'balkan'
    when lower(coalesce(r.cuisine_type,'')) like '%trad%' or lower(coalesce(r.cuisine_type,'')) like '%doma%' then 'traditional'
    else null end;

  dish_key := case
    when lower(coalesce(m.name,'') || ' ' || coalesce(m.category,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(m.name,'') || ' ' || coalesce(m.category,'')) like '%pasta%'
      or lower(coalesce(m.name,'') || ' ' || coalesce(m.category,'')) like '%carbonara%'
      or lower(coalesce(m.name,'') || ' ' || coalesce(m.category,'')) like '%lasagn%' then 'pasta'
    when lower(coalesce(m.name,'') || ' ' || coalesce(m.category,'')) like '%burger%' then 'burger'
    else null end;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into local_ig
  from (
    select term,
      popularity_score * 0.42
      + intent_score * 0.50
      - competition_score * 0.15
      + (performance_score - 50) * 0.22 as weighted_score
    from public.discovery_terms
    where active and platform='instagram' and category='local'
      and (
        lower(coalesce(city,'')) = lower(coalesce(r.city,''))
        or lower(coalesce(city,'')) = lower(coalesce(r.neighborhood,''))
      )
    order by weighted_score desc
    limit 3
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into topic_ig
  from (
    select term,
      popularity_score * 0.42
      + intent_score * 0.50
      - competition_score * 0.15
      + (performance_score - 50) * 0.22 as weighted_score
    from public.discovery_terms
    where active and platform='instagram'
      and (
        (cuisine_key is not null and cuisine = cuisine_key)
        or (dish_key is not null and cuisine = dish_key)
      )
    order by weighted_score desc
    limit 3
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into broad_ig
  from (
    select term,
      popularity_score * 0.32
      + intent_score * 0.58
      - competition_score * 0.22
      + (performance_score - 50) * 0.18 as weighted_score
    from public.discovery_terms
    where active and platform='instagram' and category='broad'
    order by weighted_score desc
    limit 1
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into local_fb
  from (
    select term,
      popularity_score * 0.30
      + intent_score * 0.60
      - competition_score * 0.20
      + (performance_score - 50) * 0.25 as weighted_score
    from public.discovery_terms
    where active and platform='facebook' and category='local'
      and (
        lower(coalesce(city,'')) = lower(coalesce(r.city,''))
        or lower(coalesce(city,'')) = lower(coalesce(r.neighborhood,''))
      )
    order by weighted_score desc
    limit 2
  ) q;

  select coalesce(array_agg(term order by weighted_score desc),'{}'::text[])
  into topic_fb
  from (
    select term,
      popularity_score * 0.30
      + intent_score * 0.60
      - competition_score * 0.20
      + (performance_score - 50) * 0.25 as weighted_score
    from public.discovery_terms
    where active and platform='facebook'
      and (
        (cuisine_key is not null and cuisine = cuisine_key)
        or (dish_key is not null and cuisine = dish_key)
      )
    order by weighted_score desc
    limit 2
  ) q;

  candidate_ig := coalesce(new.hashtags,'{}'::text[]) || local_ig || topic_ig || broad_ig;
  select coalesce(array_agg(term order by first_ord),'{}'::text[])
  into ranked_ig
  from (
    select term,min(ord) first_ord
    from unnest(candidate_ig) with ordinality as u(term,ord)
    where term is not null and btrim(term) <> ''
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
    from unnest(candidate_fb) with ordinality as u(term,ord)
    where term is not null and btrim(term) <> ''
    group by term
    order by min(ord)
    limit 3
  ) d;

  select max(last_verified_at),max(last_learned_at)
  into verified_at,learned_at
  from public.discovery_terms
  where active;

  bank_bonus := least(
    8,
    coalesce(array_length(local_ig,1),0) * 2
    + coalesce(array_length(topic_ig,1),0)
  );

  new.hashtags := ranked_ig;
  new.platform_content := coalesce(new.platform_content,'{}'::jsonb)
    || jsonb_build_object(
      'instagram',coalesce(new.platform_content->'instagram','{}'::jsonb) || jsonb_build_object(
        'hashtags',to_jsonb(ranked_ig),
        'strategy','brand + local intent + cuisine/dish + discovery bank + own performance learning'
      ),
      'facebook',coalesce(new.platform_content->'facebook','{}'::jsonb) || jsonb_build_object(
        'hashtags',to_jsonb(ranked_fb),
        'strategy','high-intent local/cuisine tags + own performance learning'
      )
    );

  new.discovery_score := least(
    99,
    greatest(
      coalesce(new.discovery_score,0),
      72
      + bank_bonus
      + case when r.city is not null then 5 else 0 end
      + case when m.image_url is not null then 5 else 0 end
    )
  );

  new.generation_meta := coalesce(new.generation_meta,'{}'::jsonb) || jsonb_build_object(
    'discovery_source','weighted-bank-learning-v2',
    'discovery_bank_verified_at',verified_at,
    'discovery_learning_at',learned_at,
    'discovery_bank_terms',jsonb_build_object(
      'instagram',ranked_ig,
      'facebook',ranked_fb
    )
  );

  return new;
end;
$function$;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-discovery-learning');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-discovery-learning',
  '55 */6 * * *',
  $cron$
    select private.refresh_discovery_performance_learning();
  $cron$
);
