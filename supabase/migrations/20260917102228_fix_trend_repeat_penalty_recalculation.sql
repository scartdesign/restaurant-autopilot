create or replace function private.apply_trend_repeat_penalties(p_restaurant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_updated integer := 0;
begin
  with recent_seed_use as (
    select
      p.restaurant_id,
      lower(trim(coalesce(p.generation_meta->>'trend_seed',''))) as seed_query,
      max(p.created_at) as last_used_at
    from public.posts p
    where p.created_at >= now()-interval '30 days'
      and (p_restaurant_id is null or p.restaurant_id=p_restaurant_id)
      and coalesce(p.generation_meta->>'trend_seed','')<>''
      and coalesce(p.generation_meta->>'generation_source','') in ('trend_opportunity','trend_autopilot_auto')
    group by p.restaurant_id,lower(trim(coalesce(p.generation_meta->>'trend_seed','')))
  ),
  ranked as (
    select
      o.id,
      r.last_used_at,
      case
        when r.last_used_at is null then 0
        when r.last_used_at >= now()-interval '3 days' then 20
        when r.last_used_at >= now()-interval '7 days' then 12
        when r.last_used_at >= now()-interval '14 days' then 6
        else 0
      end::integer as penalty
    from public.trend_content_opportunities o
    left join recent_seed_use r
      on r.restaurant_id=o.restaurant_id
     and r.seed_query=lower(trim(coalesce(o.seed_query,'')))
    where o.status='pending'
      and (p_restaurant_id is null or o.restaurant_id=p_restaurant_id)
  ),
  changed as (
    update public.trend_content_opportunities o
    set opportunity_score=least(100,greatest(0,o.opportunity_score+o.repeat_penalty-r.penalty)),
        repeat_penalty=r.penalty,
        last_seed_used_at=r.last_used_at,
        updated_at=now()
    from ranked r
    where o.id=r.id
      and (o.repeat_penalty is distinct from r.penalty or o.last_seed_used_at is distinct from r.last_used_at)
    returning 1
  )
  select count(*)::integer into v_updated from changed;

  return jsonb_build_object('ok',true,'updated',coalesce(v_updated,0),'restaurant_id',p_restaurant_id,'finished_at',now());
end;
$function$;

revoke all on function private.apply_trend_repeat_penalties(uuid) from public,anon,authenticated;
grant execute on function private.apply_trend_repeat_penalties(uuid) to service_role;