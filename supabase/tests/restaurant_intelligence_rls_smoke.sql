-- Restaurant Intelligence: read-only policy smoke tests.
-- Run with Supabase SQL editor after deploying the migration.
-- Checks structural configuration without accessing tenant data.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='restaurant_intelligence_leads';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='restaurant_intelligence_leads'
order by policyname;

select has_table_privilege('anon','public.restaurant_intelligence_leads','SELECT') as anonymous_has_select,
       has_table_privilege('authenticated','public.restaurant_intelligence_leads','SELECT') as signed_in_has_select_grant;

-- Additional mandatory tests, run with actual non-owner user session:
-- 1. SELECT must return no lead rows.
-- 2. INSERT / UPDATE / DELETE must fail or affect zero rows.
-- 3. Owner session must be able to create and read a test lead.
-- 4. Deletion of the test lead must be verified.
-- Do not impersonate auth.uid using a privileged SQL Editor session.
