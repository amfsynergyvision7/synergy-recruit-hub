-- SEC-06 REVIEW ONLY: production schema compilation verified in BEGIN/ROLLBACK.
-- Do not apply to production without full coordinated RLS migration and approval.
-- Must validate existing SELECT policies, UPDATE/DELETE policies, trigger callers,
-- approval-aware has_role implementation and application access compatibility.
begin;
drop policy "Allow all for authenticated" on public.candidate_activities;
create policy "sec06 activity insert owner scoped" on public.candidate_activities
for insert to authenticated with check (
 public.is_approved((select auth.uid()))
 and recruiter_id=(select auth.uid())
 and (public.has_role((select auth.uid()),'recruiter'::public.app_role)
      or public.has_role((select auth.uid()),'admin'::public.app_role))
 and exists (
   select 1 from public.candidates c where c.id=candidate_id
   and (c.assigned_recruiter=(select auth.uid())
        or public.has_role((select auth.uid()),'admin'::public.app_role))
 )
);
rollback;
