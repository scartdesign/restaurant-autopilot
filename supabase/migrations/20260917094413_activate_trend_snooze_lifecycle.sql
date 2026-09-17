alter table public.trend_content_opportunities
  drop constraint if exists trend_content_opportunities_status_check;

alter table public.trend_content_opportunities
  add constraint trend_content_opportunities_status_check
  check (status = any (array['pending'::text,'snoozed'::text,'created'::text,'dismissed'::text,'expired'::text]));

create or replace function private.snooze_trend_content_opportunity(p_id uuid,p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row record;
  v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_days not between 1 and 30 then raise exception 'Snooze days must be between 1 and 30'; end if;

  select o.id,o.restaurant_id,o.status,o.expires_at,r.owner_id
  into v_row
  from public.trend_content_opportunities o
  join public.restaurants r on r.id=o.restaurant_id
  where o.id=p_id;

  if v_row.id is null then raise exception 'Trend opportunity not found'; end if;
  if v_row.owner_id<>auth.uid() and not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_row.status<>'pending' then raise exception 'Only pending opportunities can be snoozed'; end if;

  v_until:=least(now()+make_interval(days=>p_days),v_row.expires_at);

  update public.trend_content_opportunities
  set status=case when v_until<=now() then 'expired' else 'snoozed' end,
      snoozed_until=v_until,
      updated_at=now()
  where id=p_id;

  return jsonb_build_object('ok',true,'id',p_id,'status',case when v_until<=now() then 'expired' else 'snoozed' end,'snoozed_until',v_until);
end;
$function$;

revoke all on function private.snooze_trend_content_opportunity(uuid,integer) from public,anon,authenticated;

create or replace function public.snooze_trend_content_opportunity(p_id uuid,p_days integer default 7)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.snooze_trend_content_opportunity(p_id,p_days);
$function$;

revoke all on function public.snooze_trend_content_opportunity(uuid,integer) from public,anon;
grant execute on function public.snooze_trend_content_opportunity(uuid,integer) to authenticated;

create or replace function private.wake_snoozed_trend_opportunities()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_woken integer:=0;
  v_expired integer:=0;
begin
  update public.trend_content_opportunities
  set status='expired',updated_at=now()
  where status='snoozed' and expires_at<=now();
  get diagnostics v_expired=row_count;

  update public.trend_content_opportunities
  set status='pending',snoozed_until=null,updated_at=now()
  where status='snoozed' and snoozed_until<=now() and expires_at>now();
  get diagnostics v_woken=row_count;

  return jsonb_build_object('ok',true,'woken',v_woken,'expired',v_expired,'finished_at',now());
end;
$function$;

revoke all on function private.wake_snoozed_trend_opportunities() from public,anon,authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='restaurant-autopilot-trend-snooze-wake';

select cron.schedule(
  'restaurant-autopilot-trend-snooze-wake',
  '15 * * * *',
  $$select private.wake_snoozed_trend_opportunities();$$
);