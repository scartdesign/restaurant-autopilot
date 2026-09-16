
create or replace function public.service_approved_discovery_boosts(p_country text default null)
returns table(
  seed_query text,
  query text,
  relevance_score integer,
  extracted_value integer,
  geo text
)
language sql
security definer
set search_path to ''
as $function$
  select c.seed_query,c.query,c.relevance_score,c.extracted_value,c.geo
  from private.discovery_candidates c
  where c.status='approved'
    and (
      c.geo=''
      or (
        c.geo='RS'
        and (
          lower(coalesce(p_country,'')) like '%serb%'
          or lower(coalesce(p_country,'')) like '%srb%'
          or coalesce(p_country,'')=''
        )
      )
    )
  order by c.relevance_score desc,c.extracted_value desc,c.last_seen_at desc
  limit 20;
$function$;

revoke all on function public.service_approved_discovery_boosts(text)
  from public,anon,authenticated;
grant execute on function public.service_approved_discovery_boosts(text)
  to service_role;
