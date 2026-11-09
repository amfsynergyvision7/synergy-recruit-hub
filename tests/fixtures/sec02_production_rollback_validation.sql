-- Read-only outcome: transactional simulation of SEC-02 RLS patch.
-- This file MUST NOT be used as a migration. All DDL is rolled back.
-- Run only in an authorized test session. No CRM rows are read.
begin;
drop policy if exists "Allow all for authenticated" on public.candidates;
drop policy if exists "Allow all for authenticated" on public.clients;
drop policy if exists "Allow all for authenticated" on public.job_openings;
drop policy if exists "Allow all for authenticated" on public.profiles;
drop policy if exists "Allow all for authenticated" on public.user_roles;
drop policy if exists "Allow all for authenticated" on public.audit_logs;
do $$
declare missing_count integer;
begin
 select count(*) into missing_count
 from (values ('candidates'),('clients'),('job_openings'),('profiles'),('user_roles'),('audit_logs')) as expected(tablename)
 where not exists (
   select 1 from pg_policies p where p.schemaname='public'
   and p.tablename=expected.tablename
 );
 if missing_count <> 0 then raise exception 'SEC-02: expected scoped policies missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
begin
 if public.is_approved(auth.uid()) or public.has_role(auth.uid(),'admin'::public.app_role)
 then raise exception 'SEC-02: synthetic unapproved actor unexpectedly authorized'; end if;
end $$;
rollback;
