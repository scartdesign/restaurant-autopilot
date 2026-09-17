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
  v_pipeline jsonb := jsonb_build_object('triggered',false);
  v_opportunities jsonb;
  v_repeat jsonb;
  v_notifications jsonb;
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

  if v_status='approved' then
    begin
      v_opportunities:=private.refresh_trend_content_opportunities(null);
      v_repeat:=private.apply_trend_repeat_penalties(null);
      v_notifications:=private.notify_high_trend_opportunities();
      v_pipeline:=jsonb_build_object(
        'triggered',true,
        'ok',true,
        'opportunities',coalesce(v_opportunities,'{}'::jsonb),
        'repeat_penalties',coalesce(v_repeat,'{}'::jsonb),
        'notifications',coalesce(v_notifications,'{}'::jsonb)
      );
    exception when others then
      v_pipeline:=jsonb_build_object('triggered',true,'ok',false,'error',sqlerrm);
    end;
  end if;

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
      'decision_alignment',v_alignment,
      'pipeline_refresh',v_pipeline
    )
  );

  return true;
end;
$function$;
