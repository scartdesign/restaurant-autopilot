do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and p.prokind='f'
      and pg_get_functiondef(p.oid) ilike '%Restaurant Autopilot%'
  loop
    v_def:=replace(pg_get_functiondef(r.oid),'Restaurant Autopilot','Restorapp');
    execute v_def;
  end loop;
end
$$;
