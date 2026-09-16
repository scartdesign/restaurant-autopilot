create or replace function public.service_record_discovery_sync(
  p_source text,
  p_status text,
  p_terms_seen integer default 0,
  p_terms_updated integer default 0,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_status text := lower(trim(coalesce(p_status,'')));
begin
  if v_status not in ('success','skipped','failed') then
    raise exception 'Invalid discovery sync status';
  end if;

  insert into private.discovery_sync_runs(
    source,
    mode,
    status,
    terms_seen,
    terms_updated,
    started_at,
    finished_at,
    error_message,
    metadata
  )
  values(
    left(coalesce(nullif(trim(p_source),''),'external_provider'),120),
    'external_ingest',
    v_status,
    greatest(coalesce(p_terms_seen,0),0),
    greatest(coalesce(p_terms_updated,0),0),
    now(),
    now(),
    case when p_error_message is null then null else left(p_error_message,1000) end,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.service_record_discovery_sync(text,text,integer,integer,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.service_record_discovery_sync(text,text,integer,integer,text,jsonb)
  to service_role;
