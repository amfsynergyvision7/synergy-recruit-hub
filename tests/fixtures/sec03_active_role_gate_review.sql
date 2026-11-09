-- SEC-03/04 REVIEW ONLY: replace role membership check with active,
-- approved, same-requester authorization. Tested in rolled-back production
-- transaction using a synthetic UUID (denied).
-- CAUTION: changes semantics for server-side checks of OTHER users; audit
-- all has_role callers and service-role workflows before any deployment.
create or replace function public.has_role(_user_id uuid,_role public.app_role)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
select _user_id=auth.uid()
 and exists(select 1 from public.profiles p
   where p.id=_user_id and p.status='approved' and p.is_active=true)
 and exists(select 1 from public.user_roles r
   where r.user_id=_user_id and r.role=_role)
$$;
-- Ensure review of public EXECUTE permissions before deployment.
