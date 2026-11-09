-- REVIEW-ONLY candidate for SEC-04. Do not run in production until
-- admin approval workflows and profile editing are integration-tested.
-- A trigger protects sensitive columns even if broad UPDATE grants remain.
create or replace function public.sec04_guard_profile_authority()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (old.status is distinct from new.status
      or old.is_active is distinct from new.is_active
      or old.role_request is distinct from new.role_request)
     and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'SEC-04: only administrators may change profile authority fields';
  end if;
  return new;
end;
$$;
revoke all on function public.sec04_guard_profile_authority() from public, anon, authenticated;
drop trigger if exists sec04_guard_profile_authority on public.profiles;
create trigger sec04_guard_profile_authority
before update on public.profiles
for each row execute function public.sec04_guard_profile_authority();
-- Verify all admin approval flows, user self-edits and service-role paths.
-- The function's SECURITY INVOKER semantics require has_role() to remain
-- callable by the database role executing the update.
