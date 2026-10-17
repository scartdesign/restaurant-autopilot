# Restaurant Intelligence rollout

Status: preview build READY; CRM data migration is NOT deployed.

## Prerequisites
1. Identify the actual Supabase project used by Restaurant Autopilot via deployment configuration; never use the BeautyNio project.
2. Apply and review `supabase/migrations/20261017134500_restaurant_intelligence_leads.sql` in a staging environment, then verify RLS with both owner and non-owner accounts.
3. Check INSERT, UPDATE, DELETE and SELECT; prove non-owner users cannot access leads through the Data API.
4. Test failed-write handling, duplicate records, and authentication expiration.
5. Only after tests, promote the branch to production.

## Sales workflow
Add restaurant from permitted public sources; manually record a factual issue with its URL and verification date; prepare a tailored draft; review it before sending. Do not claim an automated AI audit is working until it is implemented and tested.

The restaurant_intelligence_leads table holds internal sales prospects, not Restorapp customer data. No automated bulk outreach by default.
