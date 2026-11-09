-- SEC-06 scoped activity read policy: review-only, compiled in production BEGIN/ROLLBACK.
-- Do not deploy alone. Coordinate removal of permissive candidate policy,
-- candidate SELECT RLS, all activity INSERT/UPDATE/DELETE policies, triggers,
-- approval-aware role helper and actual CRM access matrix.
begin;
drop policy "Allow all for authenticated" on public.candidate_activities;
drop policy "read activities" on public.candidate_activities;
create policy "sec06 scoped activity read" on public.candidate_activities
for select to authenticated using (
 public.is_approved((select auth.uid())) and exists (
  select 1 from public.candidates c
  where c.id=candidate_id and (
   public.has_role((select auth.uid()),'admin'::public.app_role)
   or (public.has_role((select auth.uid()),'recruiter'::public.app_role)
       and c.assigned_recruiter=(select auth.uid()))
  )
 )
);
rollback;
