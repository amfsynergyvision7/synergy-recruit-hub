-- SEC-06 review-only candidate UPDATE policy; SQL compiled in
-- production transaction and rolled back.
-- Requires SEC-02 removal of broad permissive policies.
-- WARNING: WITH CHECK does not by itself prevent reassignment to another
-- recruiter if the actor remains created_by. Add immutable ownership
-- enforcement / explicit reassignment workflow before production use.
drop policy if exists "update candidates" on public.candidates;
create policy "update candidates" on public.candidates for update to authenticated
using (public.is_approved(auth.uid()) and
 (public.has_role(auth.uid(),'admin'::public.app_role) or
 ((public.has_role(auth.uid(),'recruiter'::public.app_role) or
   public.has_role(auth.uid(),'operations'::public.app_role)) and
  (assigned_recruiter=auth.uid() or created_by=auth.uid()))))
with check (public.is_approved(auth.uid()) and
 (public.has_role(auth.uid(),'admin'::public.app_role) or
 ((public.has_role(auth.uid(),'recruiter'::public.app_role) or
   public.has_role(auth.uid(),'operations'::public.app_role)) and
  (assigned_recruiter=auth.uid() or created_by=auth.uid()))));
