
create or replace function public.apply_approved_discovery_candidates()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.restaurants%rowtype;
  m public.menu_items%rowtype;
  cuisine_key text;
  dish_key text;
  approved_keywords text[] := '{}'::text[];
  candidate_keywords text[] := '{}'::text[];
  ranked_keywords text[] := '{}'::text[];
begin
  select * into r from public.restaurants where id=new.restaurant_id;
  if not found then return new; end if;

  if new.menu_item_id is not null then
    select * into m from public.menu_items where id=new.menu_item_id;
  end if;

  cuisine_key := case
    when lower(coalesce(r.cuisine_type,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(r.cuisine_type,'')) like '%burger%' or lower(coalesce(r.cuisine_type,'')) like '%fast%' then 'fast_food'
    when lower(coalesce(r.cuisine_type,'')) like '%balkan%' or lower(coalesce(r.cuisine_type,'')) like '%srp%' then 'balkan'
    when lower(coalesce(r.cuisine_type,'')) like '%trad%' or lower(coalesce(r.cuisine_type,'')) like '%doma%' then 'traditional'
    else null end;

  dish_key := case
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%pizza%' then 'pizza'
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%burger%' then 'burger'
    when lower(coalesce(m.name,'')||' '||coalesce(m.category,'')) like '%pasta%' then 'pasta'
    else null end;

  select coalesce(array_agg(query order by relevance_score desc,extracted_value desc,last_seen_at desc),'{}'::text[])
  into approved_keywords
  from (
    select c.query,c.relevance_score,c.extracted_value,c.last_seen_at
    from private.discovery_candidates c
    where c.status='approved'
      and (
        c.geo=''
        or (
          c.geo='RS'
          and (
            lower(coalesce(r.country,'')) like '%serb%'
            or lower(coalesce(r.country,'')) like '%srb%'
            or coalesce(r.country,'')=''
          )
        )
      )
      and (
        lower(c.seed_query) in ('restaurant','restoran')
        or (
          lower(c.seed_query)='pizza'
          and (cuisine_key='pizza' or dish_key='pizza')
        )
        or (
          lower(c.seed_query)='burger'
          and (cuisine_key='fast_food' or dish_key='burger')
        )
        or (
          lower(c.seed_query)='domaća hrana'
          and cuisine_key in ('balkan','traditional')
        )
        or (
          lower(c.seed_query)='street food'
          and cuisine_key='fast_food'
        )
      )
    order by c.relevance_score desc,c.extracted_value desc,c.last_seen_at desc
    limit 2
  ) q;

  candidate_keywords := coalesce(new.seo_keywords,'{}'::text[]) || approved_keywords;

  select coalesce(array_agg(keyword order by first_ord),'{}'::text[])
  into ranked_keywords
  from (
    select keyword,min(ord) first_ord
    from unnest(candidate_keywords) with ordinality u(keyword,ord)
    where keyword is not null and btrim(keyword)<>''
    group by keyword
    order by min(ord)
    limit 9
  ) d;

  new.seo_keywords := ranked_keywords;
  new.generation_meta := coalesce(new.generation_meta,'{}'::jsonb)
    || jsonb_build_object(
      'approved_trend_keywords',to_jsonb(approved_keywords),
      'approved_trend_source','owner-reviewed-google-trends'
    );

  return new;
end;
$function$;

revoke all on function public.apply_approved_discovery_candidates() from public,anon,authenticated;

drop trigger if exists posts_apply_approved_trends on public.posts;
create trigger posts_apply_approved_trends
before insert or update of generation_meta,seo_keywords,menu_item_id
on public.posts
for each row
execute function public.apply_approved_discovery_candidates();
