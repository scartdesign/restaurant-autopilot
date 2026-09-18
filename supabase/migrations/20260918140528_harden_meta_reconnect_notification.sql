create or replace function private.admin_notify_meta_reconnect(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_connection public.social_connections%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_existing bigint;
  v_notification_id bigint;
begin
  if not private.is_superadmin() then raise exception 'Forbidden'; end if;

  select * into v_connection
  from public.social_connections
  where id=p_connection_id
  for update;

  if not found then raise exception 'Meta connection not found'; end if;
  if v_connection.provider<>'meta' then raise exception 'Connection is not Meta'; end if;
  if not (
    v_connection.status in ('expired','error')
    or (
      v_connection.status='connected'
      and v_connection.token_expires_at is not null
      and v_connection.token_expires_at<=now()+interval '7 days'
    )
  ) then
    raise exception 'Meta reconnect is not required';
  end if;

  select * into v_restaurant
  from public.restaurants
  where id=v_connection.restaurant_id;
  if not found then raise exception 'Restaurant not found'; end if;

  select id into v_existing
  from public.notification_outbox
  where user_id=v_restaurant.owner_id
    and kind='admin_note'
    and payload->>'type'='meta_reconnect_required'
    and payload->>'connection_id'=p_connection_id::text
    and created_at>=now()-interval '24 hours'
  order by created_at desc
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('ok',true,'already_sent',true,'notification_id',v_existing);
  end if;

  insert into public.notification_outbox(
    user_id,kind,subject,body,payload,delivery_status,visible_in_app
  )
  values(
    v_restaurant.owner_id,
    'admin_note',
    'Meta nalog traži ponovno povezivanje',
    'Za restoran '||v_restaurant.name||' potrebno je ponovo povezati Facebook / Instagram nalog u Publish Center-u.',
    jsonb_build_object(
      'type','meta_reconnect_required',
      'restaurant_id',v_restaurant.id,
      'connection_id',p_connection_id,
      'target','publish'
    ),
    'in_app',
    true
  )
  returning id into v_notification_id;

  insert into public.admin_audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'meta_reconnect_owner_notified',
    'social_connection',
    p_connection_id::text,
    jsonb_build_object(
      'restaurant_id',v_restaurant.id,
      'owner_id',v_restaurant.owner_id,
      'notification_id',v_notification_id
    )
  );

  return jsonb_build_object('ok',true,'already_sent',false,'notification_id',v_notification_id);
end;
$function$;

revoke all on function private.admin_notify_meta_reconnect(uuid) from public,anon;
grant execute on function private.admin_notify_meta_reconnect(uuid) to authenticated;
