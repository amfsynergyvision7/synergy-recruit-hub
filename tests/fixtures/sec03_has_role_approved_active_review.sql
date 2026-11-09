-- SEC-03/05/08 review-only: approval-aware role predicate.
-- Compiled on production schema in BEGIN/ROLLBACK; NOT deployed.
-- IMPORTANT: role onboarding and bootstrap workflows must be tested.
-- SECURITY DEFINER remains due to RLS recursion considerations; restrict
-- RPC grants and audit cross-user role enumeration before production release.
begin;
create or replace function public.has_role(_user_id uuid,_role public.app_role)
returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
select exists(
 select 1 from public.user_roles ur
 join public.profiles p on p.id=ur.user_id
 where ur.user_id=_user_id and ur.role=_role
 and p.status='approved' and p.is_active=true
) $$;
rollback;
