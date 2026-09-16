create index if not exists meta_oauth_states_restaurant_idx
on public.meta_oauth_states(restaurant_id);

create index if not exists meta_oauth_states_user_idx
on public.meta_oauth_states(user_id);

create index if not exists social_publish_jobs_connection_idx
on public.social_publish_jobs(connection_id);

drop policy if exists meta_oauth_states_no_client_access on public.meta_oauth_states;
create policy meta_oauth_states_no_client_access
on public.meta_oauth_states
for all
to authenticated
using (false)
with check (false);
