-- SEC-06 review-only: related records inherit access from RLS-visible
-- candidate, or are visible to an approved creator/admin.
-- Requires the SEC-02 broad-policy removal and SEC-06 candidate RLS.
-- SQL compiled in rolled-back production transaction.
-- Must test approved operations and recruiter workflows before deployment.
drop policy if exists "read subs" on public.submissions;
create policy "read subs" on public.submissions for select to authenticated using
(public.is_approved(auth.uid()) and (public.has_role(auth.uid(),'admin'::public.app_role) or created_by=auth.uid() or exists(select 1 from public.candidates c where c.id=candidate_id)));
drop policy if exists "read int" on public.interviews;
create policy "read int" on public.interviews for select to authenticated using
(public.is_approved(auth.uid()) and (public.has_role(auth.uid(),'admin'::public.app_role) or created_by=auth.uid() or exists(select 1 from public.candidates c where c.id=candidate_id)));
drop policy if exists "read off" on public.offers;
create policy "read off" on public.offers for select to authenticated using
(public.is_approved(auth.uid()) and (public.has_role(auth.uid(),'admin'::public.app_role) or created_by=auth.uid() or exists(select 1 from public.candidates c where c.id=candidate_id)));
drop policy if exists "read activities" on public.candidate_activities;
create policy "read activities" on public.candidate_activities for select to authenticated using
(public.is_approved(auth.uid()) and (public.has_role(auth.uid(),'admin'::public.app_role) or exists(select 1 from public.candidates c where c.id=candidate_id)));
