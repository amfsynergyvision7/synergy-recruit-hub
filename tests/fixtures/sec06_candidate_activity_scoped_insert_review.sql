-- SEC-06 REVIEW ONLY: scoped candidate activity INSERT replacement.
-- Compiled in production schema BEGIN/ROLLBACK on 2026-11-09.
-- Requires isolated authenticated runtime testing of recruiter/admin,
-- operations/finance, pending/inactive, candidate visibility, and trigger flows.
-- Do NOT deploy until workflow and audit review; preserve broad policy until
-- complete 15-table coordinated remediation is authorized.
create policy "sec06 scoped activity insert" on public.candidate_activities
for insert to authenticated with check (
 public.is_approved((select auth.uid()))
 and recruiter_id=(select auth.uid())
 and (public.has_role((select auth.uid()),'admin'::public.app_role)
 or public.has_role((select auth.uid()),'recruiter'::public.app_role))
 and exists(select 1 from public.candidates c where c.id=candidate_id)
);
