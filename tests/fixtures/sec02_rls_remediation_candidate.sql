-- REVIEW-ONLY SECURITY PATCH. DO NOT APPLY TO PRODUCTION UNTESTED.
-- Evidence: current production catalog has permissive FOR ALL USING(true)
-- policies on six sensitive public tables, and anon/authenticated grants.
-- Applying this file removes only the broad bypass policies; existing
-- narrower policies remain. A full test of application access is required.
begin;
drop policy if exists "Allow all for authenticated" on public.candidates;
drop policy if exists "Allow all for authenticated" on public.clients;
drop policy if exists "Allow all for authenticated" on public.job_openings;
drop policy if exists "Allow all for authenticated" on public.profiles;
drop policy if exists "Allow all for authenticated" on public.user_roles;
drop policy if exists "Allow all for authenticated" on public.audit_logs;
-- Defense in depth: revoke anonymous access to these sensitive tables.
revoke all on public.candidates, public.clients, public.job_openings,
  public.profiles, public.user_roles, public.audit_logs from anon;
commit;
-- CAUTION: Additional policies still need review (profile self-update,
-- role integrity, approved-user predicates, team scope, and audit writes).
-- This is a candidate patch, not a complete SEC-02/04/06/07 closure.
