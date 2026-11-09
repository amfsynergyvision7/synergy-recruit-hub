-- REVIEW-ONLY SEC-02 full 15-table policy remediation.
-- DO NOT DEPLOY until approved admin/recruiter/operations/finance and
-- background-job workflow tests pass, and a rollback plan is rehearsed.
-- Existing scoped policies remain. candidate_activities lacks write policies.
-- Anonymous access is removed from these sensitive tables.
begin;
drop policy if exists "Allow all for authenticated" on public.audit_logs;
drop policy if exists "Allow all for authenticated" on public.billing;
drop policy if exists "Allow all for authenticated" on public.candidate_activities;
drop policy if exists "Allow all for authenticated" on public.candidates;
drop policy if exists "Allow all for authenticated" on public.clients;
drop policy if exists "Allow all for authenticated" on public.google_integrations;
drop policy if exists "Allow all for authenticated" on public.integrations;
drop policy if exists "Allow all for authenticated" on public.interviews;
drop policy if exists "Allow all for authenticated" on public.job_openings;
drop policy if exists "Allow all for authenticated" on public.notifications;
drop policy if exists "Allow all for authenticated" on public.offers;
drop policy if exists "Allow all for authenticated" on public.profiles;
drop policy if exists "Allow all for authenticated" on public.submissions;
drop policy if exists "Allow all for authenticated" on public.sync_logs;
drop policy if exists "Allow all for authenticated" on public.user_roles;
revoke all on public.audit_logs, public.billing, public.candidate_activities, public.candidates, public.clients, public.google_integrations, public.integrations, public.interviews, public.job_openings, public.notifications, public.offers, public.profiles, public.submissions, public.sync_logs, public.user_roles from anon;
do $$
declare broad_count integer;
begin
 select count(*) into broad_count from pg_policies
 where schemaname='public' and cmd='ALL' and qual='true';
 if broad_count <> 0 then
  raise exception 'SEC-02: % unconditional ALL policies remain',broad_count;
 end if;
end $$;
commit;
-- Reversible only with prior reviewed snapshot of original policy DDL.
-- Do not re-create unconditional ALL policies as a routine rollback.
