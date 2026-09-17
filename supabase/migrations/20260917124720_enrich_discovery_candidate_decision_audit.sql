create or replace function private.admin_set_discovery_candidate_status(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(trim(coalesce(p_status,'')));
  v_query text;
  v_pre_review jsonb := '{}'::jsonb;
  v_recommendation text;
  v_alignment text;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;
  if v_status not in ('pending','approved','rejected') then raise exception 'Invalid candidate status'; end if;

  update private.discovery_candidates
  set status=v_status,
      decided_at=case when v_status='pending' then null else now() end,
      decided_by=case when v_status='pending' then null else auth.uid() end
  where id=p_id
  returning query,coalesce(metadata->'pre_review','{}'::jsonb)
  into v_query,v_pre_review;

  if not found then raise exception 'Discovery candidate not found'; end if;

  v_recommendation:=coalesce(v_pre_review->>'recommendation','');
  v_alignment:=case
    when v_status='pending' then 'reset'
    when v_recommendation='' then 'manual_no_pre_review'
    when v_status='approved' and v_recommendation='approve' then 'aligned'
    when v_status='rejected' and v_recommendation='skip' then 'aligned'
    when v_recommendation='review' then 'manual_review_decision'
    else 'overrode_pre_review'
  end;

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
    jsonb_build_object(
      'query',v_query,
      'status',v_status,
      'pre_review',v_pre_review,
      'decision_alignment',v_alignment
    )
  );

  return true;
end;
$function$;
