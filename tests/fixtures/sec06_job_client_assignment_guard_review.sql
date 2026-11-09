-- SEC-06 REVIEW ONLY. Transactionally compiled against production.
-- Verify existing admin job-assignment and client-transfer workflows.
create or replace function public.sec06_guard_job_assignment() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if (old.created_by is distinct from new.created_by or old.assigned_recruiter is distinct from new.assigned_recruiter)
 and not (public.is_approved(auth.uid()) and public.has_role(auth.uid(),'admin'::public.app_role))
 then raise exception 'SEC-06: job assignment requires approved admin'; end if;
 return new;
end $$;
revoke all on function public.sec06_guard_job_assignment() from public,anon,authenticated;
drop trigger if exists sec06_guard_job_assignment on public.job_openings;
create trigger sec06_guard_job_assignment before update on public.job_openings
for each row execute function public.sec06_guard_job_assignment();
create or replace function public.sec06_guard_client_owner() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if old.created_by is distinct from new.created_by
 and not (public.is_approved(auth.uid()) and public.has_role(auth.uid(),'admin'::public.app_role))
 then raise exception 'SEC-06: client ownership requires approved admin'; end if;
 return new;
end $$;
revoke all on function public.sec06_guard_client_owner() from public,anon,authenticated;
drop trigger if exists sec06_guard_client_owner on public.clients;
create trigger sec06_guard_client_owner before update on public.clients
for each row execute function public.sec06_guard_client_owner();
