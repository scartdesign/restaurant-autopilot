
create index if not exists discovery_candidates_decided_by_idx
  on private.discovery_candidates(decided_by)
  where decided_by is not null;

create index if not exists trend_content_opportunities_candidate_idx
  on public.trend_content_opportunities(candidate_id);

create index if not exists trend_content_opportunities_menu_item_idx
  on public.trend_content_opportunities(menu_item_id)
  where menu_item_id is not null;

create index if not exists trend_content_opportunities_created_post_idx
  on public.trend_content_opportunities(created_post_id)
  where created_post_id is not null;
