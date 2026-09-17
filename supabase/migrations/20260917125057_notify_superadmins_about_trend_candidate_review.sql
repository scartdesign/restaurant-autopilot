alter table public.notification_outbox drop constraint if exists notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check check (kind = any (array[
  'order_created'::text,
  'order_paid'::text,
  'trial_started'::text,
  'license_activated'::text,
  'subscription_expiring'::text,
  'subscription_expired'::text,
  'admin_note'::text,
  'support_created'::text,
  'performance_reminder'::text,
  'weekly_plan_ready'::text,
  'trend_opportunity'::text,
  'trend_draft_ready'::text,
  'trend_weekly_digest'::text,
  'trend_candidate_review'::text
]));

create or replace function private.notify_discovery_candidate_pre_review()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer := 0;
  v_top_id uuid;
  v_top_query text;
  v_top_confidence integer := 0;
  v_inserted integer := 0;
begin
  select
    count(*)::integer,
    (array_agg(c.id order by coalesce((c.metadata#>>'{pre_review,confidence}')::integer,0) desc,c.relevance_score desc,c.extracted_value desc,c.last_seen_at desc))[1],
    (array_agg(c.query order by coalesce((c.metadata#>>'{pre_review,confidence}')::integer,0) desc,c.relevance_score desc,c.extracted_value desc,c.last_seen_at desc))[1],
    coalesce((array_agg(coalesce((c.metadata#>>'{pre_review,confidence}')::integer,0) order by coalesce((c.metadata#>>'{pre_review,confidence}')::integer,0) desc,c.relevance_score desc,c.extracted_value desc,c.last_seen_at desc))[1],0)
  into v_count,v_top_id,v_top_query,v_top_confidence
  from private.discovery_candidates c
  where c.status='pending'
    and c.metadata#>>'{pre_review,recommendation}'='approve';

  if coalesce(v_count,0)=0 then
    return jsonb_build_object('ok',true,'notifications_created',0,'strong_candidates',0,'finished_at',now());
  end if;

  insert into public.notification_outbox(
    user_id,recipient_email,kind,subject,body,payload,delivery_status,visible_in_app
  )
  select
    a.user_id,
    null,
    'trend_candidate_review',
    'Trend kandidati čekaju OWNER odluku',
    v_count||case when v_count=1 then ' jak trend kandidat čeka proveru.' else ' jaka trend kandidata čekaju proveru.' end||
      ' Najjači: „'||coalesce(v_top_query,'trend')||'“ ('||v_top_confidence||'% confidence). Otvori OWNER → Trend Intelligence.',
    jsonb_build_object(
      'strong_candidate_count',v_count,
      'top_candidate_id',v_top_id,
      'top_candidate_query',v_top_query,
      'top_candidate_confidence',v_top_confidence,
      'recommendation','approve',
      'review_date',current_date
    ),
    'in_app',
    true
  from public.app_admins a
  where a.role='superadmin'
    and not exists (
      select 1
      from public.notification_outbox n
      where n.kind='trend_candidate_review'
        and n.user_id=a.user_id
        and n.created_at>=date_trunc('day',now())
    );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok',true,
    'notifications_created',v_inserted,
    'strong_candidates',v_count,
    'top_candidate_id',v_top_id,
    'top_candidate_query',v_top_query,
    'finished_at',now()
  );
end;
$function$;

revoke all on function private.notify_discovery_candidate_pre_review() from public,anon,authenticated;

do $$
begin
  if exists(select 1 from cron.job where jobname='restaurant-autopilot-discovery-pre-review-alert') then
    perform cron.unschedule('restaurant-autopilot-discovery-pre-review-alert');
  end if;
  perform cron.schedule(
    'restaurant-autopilot-discovery-pre-review-alert',
    '25 4 * * *',
    'select private.notify_discovery_candidate_pre_review();'
  );
end $$;
