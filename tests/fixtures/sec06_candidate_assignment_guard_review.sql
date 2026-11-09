-- REVIEW-ONLY SEC-06 ownership integrity guard.
-- SQL compiled in a rolled-back production transaction.
-- Synthetic isolated trigger test: ordinary edit allowed, reassignment denied.
-- Before deployment verify admin workflows, service-role operations and
-- whether created_by should be immutable even to administrators.
create or replace function public.sec06_guard_candidate_assignment()
returns trigger language plpgsql security invoker
set search_path=public,pg_temp as $$
begin
 if (old.created_by is distinct from new.created_by
     or old.assigned_recruiter is distinct from new.assigned_recruiter)
    and not (public.is_approved(auth.uid())
      and public.has_role(auth.uid(),'admin'::public.app_role)) then
  raise exception 'SEC-06: only approved admins may reassign candidate ownership';
 end if;
 return new;
end $$;
revoke all on function public.sec06_guard_candidate_assignment() from public,anon,authenticated;
drop trigger if exists sec06_guard_candidate_assignment on public.candidates;
create trigger sec06_guard_candidate_assignment
before update on public.candidates for each row
execute function public.sec06_guard_candidate_assignment();
