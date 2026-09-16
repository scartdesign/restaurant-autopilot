alter table public.post_performance
  add column if not exists views integer not null default 0;

do $block$
begin
  alter table public.post_performance
    add constraint post_performance_views_check check (views >= 0);
exception
  when duplicate_object then null;
end;
$block$;
