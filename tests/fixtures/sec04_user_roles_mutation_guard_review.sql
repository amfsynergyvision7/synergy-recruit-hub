-- SEC-04 REVIEW ONLY. Verified to compile in production BEGIN/ROLLBACK.
-- Do not deploy before validating bootstrap, admin approvals, trusted service
-- workflows and all six role scenarios. RLS broad ALL policy must be removed.
-- SECURITY INVOKER: service_role exemption uses database current_user, not JWT.
create or replace function public.sec04_guard_role_mutation()
returns trigger language plpgsql security invoker
set search_path=public,pg_temp as $$
begin
 if current_user <> 'service_role'
 and not (public.is_approved(auth.uid())
          and public.has_role(auth.uid(),'admin'::public.app_role))
 then
   raise exception 'SEC-04: only approved administrators may mutate role assignments';
 end if;
 return coalesce(new,old);
end $$;
revoke all on function public.sec04_guard_role_mutation() from public,anon,authenticated;
drop trigger if exists sec04_guard_role_mutation on public.user_roles;
create trigger sec04_guard_role_mutation
before insert or update or delete on public.user_roles
for each row execute function public.sec04_guard_role_mutation();
