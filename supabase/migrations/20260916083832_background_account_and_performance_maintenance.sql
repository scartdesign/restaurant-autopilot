create or replace function private.background_maintenance()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_expired integer := 0;
  v_subscription_notices integer := 0;
  v_performance_notices integer := 0;
  v_sub record;
  v_post record;
  v_days integer;
begin
  update public.customer_subscriptions
  set status='expired', updated_at=now()
  where status in ('active','trialing')
    and expires_at is not null
    and expires_at <= now();
  get diagnostics v_expired = row_count;

  for v_sub in
    select s.id,s.user_id,s.expires_at,p.name as plan_name,u.email
    from public.customer_subscriptions s
    left join public.sales_plans p on p.id=s.plan_id
    left join auth.users u on u.id=s.user_id
    where s.status in ('active','trialing')
      and s.expires_at is not null
      and s.expires_at > now()
      and s.expires_at <= now()+interval '7 days'
  loop
    v_days := greatest(0,ceil(extract(epoch from (v_sub.expires_at-now()))/86400.0)::int);
    if v_days in (7,3,1)
      and not exists(
        select 1 from public.notification_outbox n
        where n.user_id=v_sub.user_id
          and n.kind='subscription_expiring'
          and n.payload->>'subscription_id'=v_sub.id::text
          and n.payload->>'days'=v_days::text
      )
    then
      insert into public.notification_outbox(
        user_id,recipient_email,kind,subject,body,payload,delivery_status,visible_in_app
      ) values (
        v_sub.user_id,v_sub.email,'subscription_expiring',
        'Paket ističe za '||v_days||case when v_days=1 then ' dan' else ' dana' end,
        'Paket '||coalesce(v_sub.plan_name,'Restaurant Autopilot')||' ističe '||
          to_char(v_sub.expires_at at time zone 'Europe/Belgrade','DD.MM.YYYY')||
          '. Produži ga da Autopilot ostane aktivan.',
        jsonb_build_object('subscription_id',v_sub.id,'days',v_days,'expires_at',v_sub.expires_at),
        'in_app',true
      );
      v_subscription_notices := v_subscription_notices + 1;
    end if;
  end loop;

  for v_post in
    select p.id,p.title,p.restaurant_id,p.scheduled_for,r.owner_id,u.email
    from public.posts p
    join public.restaurants r on r.id=p.restaurant_id
    left join auth.users u on u.id=r.owner_id
    where p.status='published'
      and coalesce(p.scheduled_for,p.created_at) <= now()-interval '18 hours'
      and not exists(
        select 1 from public.post_performance pf
        where pf.post_id=p.id
      )
      and not exists(
        select 1 from public.notification_outbox n
        where n.user_id=r.owner_id
          and n.kind='performance_reminder'
          and n.payload->>'post_id'=p.id::text
      )
    order by coalesce(p.scheduled_for,p.created_at) desc
    limit 100
  loop
    insert into public.notification_outbox(
      user_id,recipient_email,kind,subject,body,payload,delivery_status,visible_in_app
    ) values (
      v_post.owner_id,v_post.email,'performance_reminder',
      'Dodaj rezultate objave',
      'Objava "'||coalesce(v_post.title,'Bez naslova')||'" je označena kao objavljena. Unesi reach, reakcije i konverzije da Autopilot uči iz stvarnih rezultata.',
      jsonb_build_object('post_id',v_post.id,'restaurant_id',v_post.restaurant_id,'scheduled_for',v_post.scheduled_for),
      'in_app',true
    );
    v_performance_notices := v_performance_notices + 1;
  end loop;

  return jsonb_build_object(
    'expired',v_expired,
    'subscription_notices',v_subscription_notices,
    'performance_notices',v_performance_notices,
    'ran_at',now()
  );
end;
$function$;

revoke all on function private.background_maintenance() from public;
revoke all on function private.background_maintenance() from anon;
revoke all on function private.background_maintenance() from authenticated;
grant execute on function private.background_maintenance() to postgres;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-background-maintenance');
exception when others then
  null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-background-maintenance',
  '17 * * * *',
  'select private.background_maintenance();'
);
