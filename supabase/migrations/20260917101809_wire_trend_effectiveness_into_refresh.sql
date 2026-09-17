alter table public.trend_content_opportunities
  add column if not exists effectiveness_score integer not null default 50 check (effectiveness_score between 0 and 100),
  add column if not exists effectiveness_samples integer not null default 0 check (effectiveness_samples >= 0);

create or replace function private.apply_trend_effectiveness_to_opportunity()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_score integer; v_samples integer;
begin
  select e.effectiveness_score,e.sample_count into v_score,v_samples
  from private.trend_seed_effectiveness e
  where e.restaurant_id=new.restaurant_id
    and e.seed_query=lower(trim(coalesce(new.seed_query,'')))
    and e.last_measured_at >= now()-interval '180 days';
  new.effectiveness_score:=coalesce(v_score,50);
  new.effectiveness_samples:=coalesce(v_samples,new.performance_samples,0);
  return new;
end;
$function$;
revoke all on function private.apply_trend_effectiveness_to_opportunity() from public,anon,authenticated;

drop trigger if exists trend_opportunity_effectiveness_fill on public.trend_content_opportunities;
create trigger trend_opportunity_effectiveness_fill
before insert or update of restaurant_id,seed_query,performance_boost,performance_samples
on public.trend_content_opportunities
for each row execute function private.apply_trend_effectiveness_to_opportunity();

update public.trend_content_opportunities o
set effectiveness_score=coalesce(e.effectiveness_score,50),effectiveness_samples=coalesce(e.sample_count,o.performance_samples,0)
from private.trend_seed_effectiveness e
where e.restaurant_id=o.restaurant_id and e.seed_query=lower(trim(coalesce(o.seed_query,'')))
  and e.last_measured_at >= now()-interval '180 days';

create or replace function public.service_refresh_trend_content_opportunities(p_restaurant_id uuid default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_effectiveness jsonb; v_opportunities jsonb;
begin
  if current_user <> 'service_role' then raise exception 'Forbidden'; end if;
  v_effectiveness:=private.refresh_trend_seed_effectiveness(p_restaurant_id);
  v_opportunities:=private.refresh_trend_content_opportunities(p_restaurant_id);
  return jsonb_build_object('ok',true,'effectiveness',v_effectiveness,'opportunities',v_opportunities);
end;
$function$;
revoke all on function public.service_refresh_trend_content_opportunities(uuid) from public,anon,authenticated;
grant execute on function public.service_refresh_trend_content_opportunities(uuid) to service_role;

create or replace function private.restaurant_trend_effectiveness_feed(p_restaurant_id uuid,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
begin
  if not (public.owns_restaurant(p_restaurant_id) or private.is_superadmin()) then raise exception 'Forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.sample_count desc,x.effectiveness_score desc,x.seed_query)
    from (select seed_query,sample_count,reach_sum,round(action_rate*100,2) as action_rate_pct,
      round(baseline_action_rate*100,2) as baseline_action_rate_pct,effectiveness_boost,effectiveness_score,last_measured_at,refreshed_at
      from private.trend_seed_effectiveness where restaurant_id=p_restaurant_id
      order by sample_count desc,effectiveness_score desc,seed_query
      limit greatest(1,least(coalesce(p_limit,20),100))) x),'[]'::jsonb);
end;
$function$;
revoke all on function private.restaurant_trend_effectiveness_feed(uuid,integer) from public,anon,authenticated;

create or replace function public.restaurant_trend_effectiveness_feed(p_restaurant_id uuid,p_limit integer default 20)
returns jsonb language sql security invoker set search_path to ''
as $function$ select private.restaurant_trend_effectiveness_feed(p_restaurant_id,p_limit); $function$;
revoke all on function public.restaurant_trend_effectiveness_feed(uuid,integer) from public,anon;
grant execute on function public.restaurant_trend_effectiveness_feed(uuid,integer) to authenticated;