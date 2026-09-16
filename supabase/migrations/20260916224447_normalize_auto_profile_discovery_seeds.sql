
create or replace function private.discovery_auto_seed_suggestions(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with cuisine_parts as (
    select
      case
        when lower(coalesce(r.country,'')) like '%serb%'
          or lower(coalesce(r.country,'')) like '%srb%'
          or coalesce(r.country,'')=''
        then 'RS' else ''
      end as geo,
      trim(part) as raw_query,
      'cuisine'::text as source
    from public.restaurants r
    cross join lateral regexp_split_to_table(
      regexp_replace(coalesce(r.cuisine_type,''), '\s+(and|i)\s+', ' & ', 'gi'),
      '\s*[&,/]\s*'
    ) as part
    where r.cuisine_type is not null
  ),
  menu_parts as (
    select
      case
        when lower(coalesce(r.country,'')) like '%serb%'
          or lower(coalesce(r.country,'')) like '%srb%'
          or coalesce(r.country,'')=''
        then 'RS' else ''
      end as geo,
      trim(m.category) as raw_query,
      'menu_category'::text as source
    from public.menu_items m
    join public.restaurants r on r.id=m.restaurant_id
    where m.is_active
      and m.category is not null
  ),
  normalized as (
    select
      geo,
      case
        when lower(raw_query)='desert' then 'dessert'
        else trim(regexp_replace(raw_query,'^(modern|moderna|moderan|traditional|tradicionalna|tradicionalan|premium|casual)\s+','','i'))
      end as query,
      source
    from (
      select * from cuisine_parts
      union all
      select * from menu_parts
    ) x
  ),
  filtered as (
    select *
    from normalized
    where length(query) between 2 and 40
      and lower(query) not in (
        'ostalo','other','ostala jela','jela','food','hrana',
        'piće','pice','drinks','napici','menu','meni',
        'modern','moderna','moderan','traditional','tradicionalna',
        'tradicionalan','premium','casual'
      )
      and query !~ '[[:cntrl:]]'
  ),
  grouped as (
    select
      geo,
      lower(query) as query_key,
      min(query) as query,
      count(*)::integer as usage_count,
      min(source) as source
    from filtered
    group by geo,lower(query)
  ),
  ranked as (
    select *
    from grouped
    order by usage_count desc,query_key
    limit greatest(0,least(coalesce(p_limit,12),30))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'geo',geo,
    'query',query,
    'usage_count',usage_count,
    'source',source
  ) order by usage_count desc,query),'[]'::jsonb)
  from ranked;
$function$;

revoke all on function private.discovery_auto_seed_suggestions(integer) from public,anon,authenticated;
