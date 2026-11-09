-- SEC-03/04 REVIEW ONLY: active/approved role membership.
-- Preserve has_role(user_id,role) lookup semantics for server-side checks
-- of other users; caller authorization must be enforced separately.
-- Security-definer function remains privileged: review EXECUTE grants,
-- exposed RPC use, RLS interactions, and all callers before deployment.
-- Isolated synthetic matrix: approved active -> true; pending -> false;
-- inactive -> false. No production deployment.
create or replace function public.has_role(_user_id uuid,_role public.app_role)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
select _user_id is not null
 and exists(select 1 from public.profiles p
   where p.id=_user_id and p.status='approved' and p.is_active=true)
 and exists(select 1 from public.user_roles r
   where r.user_id=_user_id and r.role=_role)
$$;
-- Note: callers must never treat this as permission to act on _user_id.
-- To authorize the CURRENT caller, explicitly require _user_id=auth.uid()
-- at the call site, or use a separately reviewed current-user helper.
