create or replace function public.service_discovery_engine_runtime()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_settings record; v_seeds jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_settings from private.discovery_engine_settings where id=1;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'geo',geo,'query',query,'sort_order',sort_order) order by sort_order,geo,query),'[]'::jsonb)
  into v_seeds
  from (select * from private.discovery_seed_terms where active order by sort_order,geo,query limit v_settings.candidate_seed_limit) s;
  return jsonb_build_object(
    'provider_enabled',v_settings.provider_enabled,
    'per_sync_call_limit',v_settings.per_sync_call_limit,
    'daily_call_limit',v_settings.daily_call_limit,
    'daily_calls_used',private.discovery_daily_api_calls_used(),
    'candidate_seed_limit',v_settings.candidate_seed_limit,
    'auto_profile_seeds_enabled',v_settings.auto_profile_seeds_enabled,
    'seeds',v_seeds,
    'auto_seeds',case when v_settings.auto_profile_seeds_enabled then private.discovery_auto_seed_suggestions(v_settings.candidate_seed_limit) else '[]'::jsonb end
  );
end;
$function$;
revoke all on function public.service_discovery_engine_runtime() from public,anon,authenticated;
grant execute on function public.service_discovery_engine_runtime() to service_role;

create or replace function public.service_record_trend_autopilot_run(
  p_status text,p_restaurants_seen integer,p_created_count integer,p_skipped_count integer,
  p_started_at timestamptz,p_results jsonb,p_error_message text default null
)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_id uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Forbidden'; end if;
  if p_status not in ('success','failed') then raise exception 'Invalid status'; end if;
  insert into private.trend_autopilot_runs(status,restaurants_seen,created_count,skipped_count,started_at,finished_at,error_message,results)
  values(p_status,greatest(coalesce(p_restaurants_seen,0),0),greatest(coalesce(p_created_count,0),0),greatest(coalesce(p_skipped_count,0),0),coalesce(p_started_at,now()),now(),p_error_message,coalesce(p_results,'[]'::jsonb))
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.service_record_trend_autopilot_run(text,integer,integer,integer,timestamptz,jsonb,text) from public,anon,authenticated;
grant execute on function public.service_record_trend_autopilot_run(text,integer,integer,integer,timestamptz,jsonb,text) to service_role;