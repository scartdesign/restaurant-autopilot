create table if not exists private.discovery_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  mode text not null check (mode in ('health','external_ingest','performance_learning')),
  status text not null check (status in ('started','success','skipped','failed')),
  terms_seen integer not null default 0 check (terms_seen >= 0),
  terms_inserted integer not null default 0 check (terms_inserted >= 0),
  terms_updated integer not null default 0 check (terms_updated >= 0),
  terms_deactivated integer not null default 0 check (terms_deactivated >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists discovery_sync_runs_started_idx
  on private.discovery_sync_runs (started_at desc);

revoke all on table private.discovery_sync_runs from public, anon, authenticated;

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
  v_last_run jsonb;
begin
  if not private.is_superadmin() then
    raise exception 'Forbidden';
  end if;

  select
    count(*)::integer,
    count(*) filter (where active)::integer,
    count(*) filter (where active and last_verified_at < now() - interval '7 days')::integer,
    count(*) filter (where active and last_verified_at < now() - interval '30 days')::integer,
    max(last_verified_at) filter (where active),
    min(last_verified_at) filter (where active)
  into v_total, v_active, v_stale_7d, v_stale_30d, v_latest, v_oldest
  from public.discovery_terms;

  select coalesce(jsonb_object_agg(source, cnt order by source), '{}'::jsonb)
  into v_sources
  from (
    select source, count(*)::integer as cnt
    from public.discovery_terms
    where active
    group by source
  ) s;

  select coalesce(jsonb_object_agg(platform, cnt order by platform), '{}'::jsonb)
  into v_platforms
  from (
    select platform, count(*)::integer as cnt
    from public.discovery_terms
    where active
    group by platform
  ) p;

  select coalesce(jsonb_object_agg(category, cnt order by category), '{}'::jsonb)
  into v_categories
  from (
    select category, count(*)::integer as cnt
    from public.discovery_terms
    where active
    group by category
  ) c;

  select count(*)::integer, count(distinct restaurant_id)::integer
  into v_performance_samples, v_performance_restaurants
  from public.post_performance;

  select to_jsonb(r)
  into v_last_run
  from (
    select id, source, mode, status, terms_seen, terms_inserted, terms_updated,
           terms_deactivated, started_at, finished_at, error_message, metadata
    from private.discovery_sync_runs
    order by started_at desc
    limit 1
  ) r;

  return jsonb_build_object(
    'mode', 'curated_weighted_bank',
    'live_search_volume', false,
    'external_provider_configured', false,
    'total_terms', v_total,
    'active_terms', v_active,
    'stale_7d', v_stale_7d,
    'stale_30d', v_stale_30d,
    'latest_verified_at', v_latest,
    'oldest_verified_at', v_oldest,
    'sources', v_sources,
    'platforms', v_platforms,
    'categories', v_categories,
    'performance_samples', v_performance_samples,
    'performance_restaurants', v_performance_restaurants,
    'last_sync_run', v_last_run
  );
end;
$function$;

revoke all on function private.admin_discovery_health() from public, anon;
grant execute on function private.admin_discovery_health() to authenticated;

create or replace function public.admin_discovery_health()
returns jsonb
language sql
set search_path to ''
as $function$
  select private.admin_discovery_health();
$function$;

revoke all on function public.admin_discovery_health() from public, anon;
grant execute on function public.admin_discovery_health() to authenticated;

comment on function public.admin_discovery_health() is
  'OWNER-only health summary for the weighted Discovery Bank. Does not claim live search volume.';
