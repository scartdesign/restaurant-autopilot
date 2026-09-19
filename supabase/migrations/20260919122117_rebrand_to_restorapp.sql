alter table public.app_controls alter column app_name set default 'Restorapp';
alter table public.sales_settings alter column email_sender_name set default 'Restorapp';

update public.app_controls
set app_name='Restorapp'
where app_name='Restaurant Autopilot';

update public.sales_settings
set email_sender_name='Restorapp'
where email_sender_name='Restaurant Autopilot';
