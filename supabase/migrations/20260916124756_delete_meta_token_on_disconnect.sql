create or replace function public.service_delete_social_token(p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id
  from public.social_connections
  where id=p_connection_id;

  if v_secret_id is not null then
    delete from vault.secrets where id=v_secret_id;
  end if;

  update public.social_connections
  set token_secret_id=null,token_expires_at=null,updated_at=now()
  where id=p_connection_id;

  return true;
end;
$function$;

revoke all on function public.service_delete_social_token(uuid) from public,anon,authenticated;
grant execute on function public.service_delete_social_token(uuid) to service_role;
