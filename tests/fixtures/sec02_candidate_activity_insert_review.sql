-- REVIEW-ONLY: preserve legitimate candidate activity creation when
-- the broad public ALL policy is removed. Transactionally compiled against
-- the real production schema; no persistent production change made.
-- NOTE: record-level/team access still depends on candidates RLS and must
-- be strengthened before production approval.
create policy "approved staff insert candidate activity" on public.candidate_activities
for insert to authenticated
with check (
 public.is_approved(auth.uid())
 and (public.has_role(auth.uid(),'admin'::public.app_role)
  or public.has_role(auth.uid(),'recruiter'::public.app_role)
  or public.has_role(auth.uid(),'operations'::public.app_role))
 and exists(select 1 from public.candidates c where c.id=candidate_id)
 and (recruiter_id is null or recruiter_id=auth.uid()
  or public.has_role(auth.uid(),'admin'::public.app_role))
);
