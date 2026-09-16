alter table public.menu_items
  add constraint menu_items_marketing_priority_range
  check (marketing_priority between 0 and 3);

create unique index if not exists menu_items_one_hero_per_restaurant_idx
  on public.menu_items (restaurant_id)
  where marketing_priority = 3;
