-- Build79 REVIEW-ONLY MINIMAL RLS POLICY PILOT. NEVER RUN against production/staging.
-- Also NOT applied to nonproduction; the live attempt was blocked by safety controls.
-- This artifact is an inert transactional proposal, NOT a production migration.
-- It is insufficient for the historical 135 signed-read test matrix.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '40s';
DO $guard$ BEGIN
 IF (SELECT count(*) FROM auth.users) <> 0 OR
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') <> 0 OR
    (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relkind='r' AND relrowsecurity AND relforcerowsecurity) <> 19 OR
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled='D') <> 32
 THEN RAISE EXCEPTION 'Build79 review-only lab preconditions not satisfied'; END IF;
END $guard$;

-- Each user may read only their own synthetic profile and own role record.
-- No JWT user_metadata/role claim may grant elevated access.
CREATE POLICY build79_self_profile_read ON public.profiles
 FOR SELECT TO authenticated USING (id=(select auth.uid()));
CREATE POLICY build79_self_role_read ON public.user_roles
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));

-- Only an approved, active recruiter may read their own candidates.
-- The self-role policy ensures the role lookup cannot see another user's role.
CREATE POLICY build79_approved_recruiter_owned_candidate_read ON public.candidates
 FOR SELECT TO authenticated USING (
  assigned_recruiter=(select auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id=(select auth.uid())
                AND p.status='approved' AND p.is_active)
  AND EXISTS (SELECT 1 FROM public.user_roles r
              WHERE r.user_id=(select auth.uid()) AND r.role='recruiter')
 );
GRANT SELECT ON public.profiles,public.user_roles,public.candidates TO authenticated;
-- No anon access; no INSERT/UPDATE/DELETE/TRUNCATE; no other app table or view grant.
-- Intentionally no administrator, finance, operations, viewer or cross-table policy.
-- Admin full 135-case access requires distinct independent proposal/review.

DO $post$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public') <> 3 OR
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND (cmd <> 'SELECT' OR roles::text <> '{authenticated}' OR
       tablename NOT IN ('profiles','user_roles','candidates')))
 THEN RAISE EXCEPTION 'Build79 policy pilot contains unexpected access rules'; END IF;
 IF has_table_privilege('anon','public.candidates','SELECT') OR
    has_table_privilege('anon','public.profiles','SELECT') OR
    has_table_privilege('anon','public.user_roles','SELECT') OR
    has_table_privilege('authenticated','public.candidates','INSERT,UPDATE,DELETE,TRUNCATE')
 THEN RAISE EXCEPTION 'Build79 policy pilot privileges exceed read-only boundary'; END IF;
END $post$;
ROLLBACK;
-- The live connector safety control blocked the proposed execution of this pilot.
-- Do not bypass that restriction by alternate live-SQL invocation.
