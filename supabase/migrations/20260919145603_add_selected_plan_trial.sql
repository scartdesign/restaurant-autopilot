create or replace function private.request_plan_trial(p_plan_id uuid)
returns public.customer_subscriptions
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_plan public.sales_plans%rowtype;
  v_row public.customer_subscriptions%rowtype;
  v_days integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.sales_settings where id=1 and trial_enabled) then raise exception 'Trial is disabled'; end if;
  if exists(select 1 from public.customer_subscriptions where user_id=v_uid)
     or exists(select 1 from public.customer_profiles where user_id=v_uid and trial_claimed_at is not null)
  then raise exception 'Trial has already been used'; end if;

  select * into v_plan
  from public.sales_plans
  where id=p_plan_id and active and public;

  if v_plan.id is null then raise exception 'Plan is not available for trial'; end if;
  v_days:=greatest(1,coalesce(v_plan.trial_days,7));

  insert into public.customer_subscriptions(
    user_id,plan_id,status,starts_at,expires_at,payment_method,external_reference
  )
  values(
    v_uid,v_plan.id,'trialing',now(),now()+make_interval(days=>v_days),'manual','self-service-plan-trial'
  )
  returning * into v_row;

  update public.customer_profiles set trial_claimed_at=now() where user_id=v_uid;
  perform private.audit_event('trial_started','subscription',v_row.id::text,jsonb_build_object('user_id',v_uid,'plan',v_plan.code,'days',v_days,'source','selected_plan'));
  perform private.queue_notice(v_uid,'trial_started','Probni period je aktivan','Imaš '||v_days||' dana da isprobaš Restorapp '||v_plan.name||'.',jsonb_build_object('subscription_id',v_row.id,'expires_at',v_row.expires_at,'plan_id',v_plan.id));
  return v_row;
end;
$function$;

revoke all on function private.request_plan_trial(uuid) from public,anon;
grant execute on function private.request_plan_trial(uuid) to authenticated;

create or replace function public.request_plan_trial(p_plan_id uuid)
returns public.customer_subscriptions
language sql
security invoker
set search_path=''
as $function$
  select private.request_plan_trial(p_plan_id);
$function$;

revoke all on function public.request_plan_trial(uuid) from public,anon;
grant execute on function public.request_plan_trial(uuid) to authenticated;
