
create table if not exists private.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  seed_query text not null,
  query text not null,
  geo text not null default '',
  trend_type text not null check (trend_type in ('rising','top')),
  trend_value text,
  extracted_value integer not null default 0 check (extracted_value >= 0),
  relevance_score integer not null default 50 check (relevance_score between 0 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists discovery_candidates_provider_geo_query_uidx
  on private.discovery_candidates (provider,geo,lower(query));

create index if not exists discovery_candidates_status_score_idx
  on private.discovery_candidates (status,relevance_score desc,extracted_value desc,last_seen_at desc);

revoke all on table private.discovery_candidates from public,anon,authenticated;

create or replace function public.service_upsert_discovery_candidate(
  p_provider text,
  p_seed_query text,
  p_query text,
  p_geo text,
  p_trend_type text,
  p_trend_value text,
  p_extracted_value integer,
  p_relevance_score integer,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_query text := trim(coalesce(p_query,''));
  v_type text := lower(trim(coalesce(p_trend_type,'')));
begin
  if v_query='' then raise exception 'Discovery candidate query is required'; end if;
  if v_type not in ('rising','top') then raise exception 'Invalid trend type'; end if;

  insert into private.discovery_candidates(
    provider,seed_query,query,geo,trend_type,trend_value,
    extracted_value,relevance_score,metadata,last_seen_at
  )
  values(
    left(coalesce(nullif(trim(p_provider),''),'unknown'),120),
    left(trim(coalesce(p_seed_query,'')),240),
    left(v_query,400),
    left(coalesce(p_geo,''),32),
    v_type,
    left(coalesce(p_trend_value,''),80),
    greatest(coalesce(p_extracted_value,0),0),
    least(100,greatest(0,coalesce(p_relevance_score,50))),
    coalesce(p_metadata,'{}'::jsonb),
    now()
  )
  on conflict (provider,geo,(lower(query)))
  do update set
    seed_query=excluded.seed_query,
    trend_type=excluded.trend_type,
    trend_value=excluded.trend_value,
    extracted_value=greatest(private.discovery_candidates.extracted_value,excluded.extracted_value),
    relevance_score=greatest(private.discovery_candidates.relevance_score,excluded.relevance_score),
    last_seen_at=now(),
    metadata=private.discovery_candidates.metadata || excluded.metadata
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.service_upsert_discovery_candidate(text,text,text,text,text,text,integer,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.service_upsert_discovery_candidate(text,text,text,text,text,text,integer,integer,jsonb)
  to service_role;

create or replace function private.admin_discovery_candidate_feed(p_limit integer default 40)
returns table(
  id uuid,
  provider text,
  seed_query text,
  query text,
  geo text,
  trend_type text,
  trend_value text,
  extracted_value integer,
  relevance_score integer,
  status text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  decided_at timestamptz,
  metadata jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  return query
  select
    c.id,c.provider,c.seed_query,c.query,c.geo,c.trend_type,c.trend_value,
    c.extracted_value,c.relevance_score,c.status,c.first_seen_at,c.last_seen_at,
    c.decided_at,c.metadata
  from private.discovery_candidates c
  order by
    case c.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    c.relevance_score desc,
    c.extracted_value desc,
    c.last_seen_at desc
  limit greatest(1,least(coalesce(p_limit,40),100));
end;
$function$;

revoke all on function private.admin_discovery_candidate_feed(integer) from public,anon;
grant execute on function private.admin_discovery_candidate_feed(integer) to authenticated;

create or replace function public.admin_discovery_candidate_feed(p_limit integer default 40)
returns table(
  id uuid,
  provider text,
  seed_query text,
  query text,
  geo text,
  trend_type text,
  trend_value text,
  extracted_value integer,
  relevance_score integer,
  status text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  decided_at timestamptz,
  metadata jsonb
)
language sql
set search_path to ''
as $function$
  select * from private.admin_discovery_candidate_feed(p_limit);
$function$;

revoke all on function public.admin_discovery_candidate_feed(integer) from public,anon;
grant execute on function public.admin_discovery_candidate_feed(integer) to authenticated;

create or replace function private.admin_set_discovery_candidate_status(
  p_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(trim(coalesce(p_status,'')));
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_status not in ('pending','approved','rejected') then raise exception 'Invalid candidate status'; end if;

  update private.discovery_candidates
  set status=v_status,
      decided_at=case when v_status='pending' then null else now() end,
      decided_by=case when v_status='pending' then null else auth.uid() end
  where id=p_id;

  if not found then raise exception 'Discovery candidate not found'; end if;
  return true;
end;
$function$;

revoke all on function private.admin_set_discovery_candidate_status(uuid,text) from public,anon;
grant execute on function private.admin_set_discovery_candidate_status(uuid,text) to authenticated;

create or replace function public.admin_set_discovery_candidate_status(
  p_id uuid,
  p_status text
)
returns boolean
language sql
set search_path to ''
as $function$
  select private.admin_set_discovery_candidate_status(p_id,p_status);
$function$;

revoke all on function public.admin_set_discovery_candidate_status(uuid,text) from public,anon;
grant execute on function public.admin_set_discovery_candidate_status(uuid,text) to authenticated;
