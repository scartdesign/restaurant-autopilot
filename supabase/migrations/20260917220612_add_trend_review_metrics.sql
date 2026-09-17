create or replace function private.admin_trend_review_metrics()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer:=0;
  v_approved integer:=0;
  v_rejected integer:=0;
  v_aligned integer:=0;
  v_overridden integer:=0;
  v_manual_review integer:=0;
  v_no_pre_review integer:=0;
  v_recommend_approve integer:=0;
  v_recommend_review integer:=0;
  v_recommend_skip integer:=0;
  v_last timestamptz;
  v_comparable integer:=0;
  v_alignment_rate numeric:=null;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select
    count(*)::integer,
    count(*) filter(where action='discovery_candidate_approved')::integer,
    count(*) filter(where action='discovery_candidate_rejected')::integer,
    count(*) filter(where details->>'decision_alignment'='aligned')::integer,
    count(*) filter(where details->>'decision_alignment'='overrode_pre_review')::integer,
    count(*) filter(where details->>'decision_alignment'='manual_review_decision')::integer,
    count(*) filter(where details->>'decision_alignment'='manual_no_pre_review')::integer,
    count(*) filter(where details#>>'{pre_review,recommendation}'='approve')::integer,
    count(*) filter(where details#>>'{pre_review,recommendation}'='review')::integer,
    count(*) filter(where details#>>'{pre_review,recommendation}'='skip')::integer,
    max(created_at)
  into v_total,v_approved,v_rejected,v_aligned,v_overridden,v_manual_review,v_no_pre_review,
       v_recommend_approve,v_recommend_review,v_recommend_skip,v_last
  from public.admin_audit_log
  where entity_type='discovery_candidate'
    and action in ('discovery_candidate_approved','discovery_candidate_rejected')
    and created_at>=now()-interval '90 days';

  v_comparable:=coalesce(v_aligned,0)+coalesce(v_overridden,0);
  if v_comparable>0 then
    v_alignment_rate:=round((v_aligned::numeric/v_comparable::numeric)*100,1);
  end if;

  return jsonb_build_object(
    'window_days',90,
    'decisions',coalesce(v_total,0),
    'approved',coalesce(v_approved,0),
    'rejected',coalesce(v_rejected,0),
    'aligned',coalesce(v_aligned,0),
    'overridden',coalesce(v_overridden,0),
    'manual_review',coalesce(v_manual_review,0),
    'no_pre_review',coalesce(v_no_pre_review,0),
    'comparable_decisions',v_comparable,
    'alignment_rate',v_alignment_rate,
    'recommendations',jsonb_build_object(
      'approve',coalesce(v_recommend_approve,0),
      'review',coalesce(v_recommend_review,0),
      'skip',coalesce(v_recommend_skip,0)
    ),
    'last_decision_at',v_last,
    'generated_at',now()
  );
end;
$function$;

revoke all on function private.admin_trend_review_metrics() from public,anon,authenticated;

create or replace function public.admin_trend_review_metrics()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.admin_trend_review_metrics();
$function$;

revoke all on function public.admin_trend_review_metrics() from public,anon;
grant execute on function public.admin_trend_review_metrics() to authenticated;
