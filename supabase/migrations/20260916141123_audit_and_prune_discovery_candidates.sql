
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
  v_query text;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_status not in ('pending','approved','rejected') then raise exception 'Invalid candidate status'; end if;

  update private.discovery_candidates
  set status=v_status,
      decided_at=case when v_status='pending' then null else now() end,
      decided_by=case when v_status='pending' then null else auth.uid() end
  where id=p_id
  returning query into v_query;

  if not found then raise exception 'Discovery candidate not found'; end if;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    case v_status
      when 'approved' then 'discovery_candidate_approved'
      when 'rejected' then 'discovery_candidate_rejected'
      else 'discovery_candidate_reset'
    end,
    'discovery_candidate',
    p_id,
    jsonb_build_object('query',v_query,'status',v_status)
  );

  return true;
end;
$function$;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-discovery-candidate-cleanup');
exception when others then null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-discovery-candidate-cleanup',
  '40 4 * * *',
  $cron$
    delete from private.discovery_candidates
    where
      (status='rejected' and last_seen_at < now() - interval '90 days')
      or
      (status='pending' and last_seen_at < now() - interval '45 days');
  $cron$
);
