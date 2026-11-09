-- SEC-06 review-only record-scope RLS candidate.
-- SQL compiled successfully inside a rolled-back production transaction.
-- WARNING: owner/assignee model may not match all operations/finance use cases.
-- Do not deploy until workflows and related-table policies are validated.
-- Must be combined with removal of the unconditional public ALL policies.
drop policy if exists "read candidates" on public.candidates;
create policy "read candidates" on public.candidates for select to authenticated
using (public.is_approved(auth.uid()) and
 (public.has_role(auth.uid(),'admin'::public.app_role)
  or assigned_recruiter=auth.uid() or created_by=auth.uid()));
drop policy if exists "read jobs" on public.job_openings;
create policy "read jobs" on public.job_openings for select to authenticated
using (public.is_approved(auth.uid()) and
 (public.has_role(auth.uid(),'admin'::public.app_role)
  or assigned_recruiter=auth.uid() or created_by=auth.uid()));
drop policy if exists "read clients" on public.clients;
create policy "read clients" on public.clients for select to authenticated
using (public.is_approved(auth.uid()) and
 (public.has_role(auth.uid(),'admin'::public.app_role)
  or created_by=auth.uid()));
