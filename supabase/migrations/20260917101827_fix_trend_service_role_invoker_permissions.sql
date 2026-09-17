grant execute on function private.refresh_trend_seed_effectiveness(uuid) to service_role;
grant execute on function private.refresh_trend_content_opportunities(uuid) to service_role;

create or replace function public.service_refresh_trend_seed_effectiveness(p_restaurant_id uuid default null)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.refresh_trend_seed_effectiveness(p_restaurant_id); $function$;
revoke all on function public.service_refresh_trend_seed_effectiveness(uuid) from public,anon,authenticated;
grant execute on function public.service_refresh_trend_seed_effectiveness(uuid) to service_role;

create or replace function public.service_refresh_trend_content_opportunities(p_restaurant_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to ''
as $function$
declare v_effectiveness jsonb; v_opportunities jsonb;
begin
  v_effectiveness:=private.refresh_trend_seed_effectiveness(p_restaurant_id);
  v_opportunities:=private.refresh_trend_content_opportunities(p_restaurant_id);
  return jsonb_build_object('ok',true,'effectiveness',v_effectiveness,'opportunities',v_opportunities);
end;
$function$;
revoke all on function public.service_refresh_trend_content_opportunities(uuid) from public,anon,authenticated;
grant execute on function public.service_refresh_trend_content_opportunities(uuid) to service_role;