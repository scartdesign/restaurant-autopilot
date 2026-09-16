create index if not exists post_performance_restaurant_platform_measured_idx
  on public.post_performance (restaurant_id, platform, measured_at desc);

create index if not exists posts_restaurant_created_idx
  on public.posts (restaurant_id, created_at desc)
  include (menu_item_id);

create index if not exists posts_restaurant_scheduled_idx
  on public.posts (restaurant_id, scheduled_for desc);
