
create table if not exists private.trend_autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('success','failed')),
  restaurants_seen integer not null default 0 check (restaurants_seen >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  error_message text,
  results jsonb not null default '[]'::jsonb
);

create index if not exists trend_autopilot_runs_started_idx
  on private.trend_autopilot_runs(started_at desc);

revoke all on table private.trend_autopilot_runs from public,anon,authenticated;

create or replace function public.service_record_trend_autopilot_run(
  p_status text,
  p_restaurants_seen integer,
  p_created_count integer,
  p_skipped_count integer,
  p_started_at timestamptz,
  p_results jsonb,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if current_user <> 'service_role' then raise exception 'Forbidden'; end if;
  if p_status not in ('success','failed') then raise exception 'Invalid status'; end if;

  insert into private.trend_autopilot_runs(
    status,restaurants_seen,created_count,skipped_count,started_at,finished_at,error_message,results
  )
  values(
    p_status,
    greatest(coalesce(p_restaurants_seen,0),0),
    greatest(coalesce(p_created_count,0),0),
    greatest(coalesce(p_skipped_count,0),0),
    coalesce(p_started_at,now()),
    now(),
    p_error_message,
    coalesce(p_results,'[]'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.service_record_trend_autopilot_run(text,integer,integer,integer,timestamptz,jsonb,text) from public,anon,authenticated;
grant execute on function public.service_record_trend_autopilot_run(text,integer,integer,integer,timestamptz,jsonb,text) to service_role;

create or replace function private.admin_trend_autopilot_health()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_modes jsonb;
  v_opps jsonb;
  v_learning jsonb;
  v_last record;
  v_statuses jsonb := '{}'::jsonb;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select coalesce(jsonb_object_agg(trend_autopilot_mode,cnt),'{}'::jsonb)
  into v_modes
  from (
    select trend_autopilot_mode,count(*)::integer cnt
    from public.restaurants
    group by trend_autopilot_mode
  ) x;

  select jsonb_build_object(
    'pending',count(*) filter (where status='pending'),
    'created',count(*) filter (where status='created'),
    'dismissed',count(*) filter (where status='dismissed'),
    'expired',count(*) filter (where status='expired'),
    'total',count(*)
  )
  into v_opps
  from public.trend_content_opportunities;

  select jsonb_build_object(
    'sampled',count(*) filter (where performance_samples>0),
    'positive',count(*) filter (where performance_samples>0 and performance_boost>0),
    'negative',count(*) filter (where performance_samples>0 and performance_boost<0),
    'strong_negative',count(*) filter (where performance_samples>=3 and performance_boost<=-4)
  )
  into v_learning
  from public.trend_content_opportunities;

  select *
  into v_last
  from private.trend_autopilot_runs
  order by started_at desc
  limit 1;

  if v_last.id is not null then
    select coalesce(jsonb_object_agg(status,cnt),'{}'::jsonb)
    into v_statuses
    from (
      select item->>'status' as status,count(*)::integer cnt
      from jsonb_array_elements(v_last.results) item
      where coalesce(item->>'status','')<>''
      group by item->>'status'
    ) s;
  end if;

  return jsonb_build_object(
    'modes',v_modes,
    'opportunities',coalesce(v_opps,'{}'::jsonb),
    'learning',coalesce(v_learning,'{}'::jsonb),
    'last_run',case when v_last.id is null then null else jsonb_build_object(
      'id',v_last.id,
      'status',v_last.status,
      'restaurants_seen',v_last.restaurants_seen,
      'created_count',v_last.created_count,
      'skipped_count',v_last.skipped_count,
      'started_at',v_last.started_at,
      'finished_at',v_last.finished_at,
      'error_message',v_last.error_message,
      'statuses',v_statuses
    ) end
  );
end;
$function$;

revoke all on function private.admin_trend_autopilot_health() from public,anon,authenticated;

create or replace function public.admin_trend_autopilot_health()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_trend_autopilot_health();
$function$;

revoke all on function public.admin_trend_autopilot_health() from public,anon;
grant execute on function public.admin_trend_autopilot_health() to authenticated;
