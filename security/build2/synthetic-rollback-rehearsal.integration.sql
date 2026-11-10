-- Disposable PostgreSQL rollback rehearsal, NOT a production rollback script.
-- Verifies transactional restoration of policies, grants and view reloptions.
CREATE TABLE public.build2_rollback_candidates(id uuid PRIMARY KEY, owner_id uuid);
ALTER TABLE public.build2_rollback_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY build2_rollback_legacy ON public.build2_rollback_candidates
 FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
GRANT SELECT ON public.build2_rollback_candidates TO anon;
CREATE VIEW public.build2_rollback_view AS
 SELECT id,owner_id FROM public.build2_rollback_candidates;
GRANT SELECT ON public.build2_rollback_view TO anon;
DO $check$
BEGIN
 IF NOT has_table_privilege('anon','public.build2_rollback_candidates','SELECT')
 THEN RAISE EXCEPTION 'fixture table grant absent'; END IF;
 IF NOT has_table_privilege('anon','public.build2_rollback_view','SELECT')
 THEN RAISE EXCEPTION 'fixture view grant absent'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='build2_rollback_candidates'
 AND policyname='build2_rollback_legacy') THEN RAISE EXCEPTION 'legacy policy absent'; END IF;
END $check$;
BEGIN;
SAVEPOINT build2_pre_migration;
DROP POLICY build2_rollback_legacy ON public.build2_rollback_candidates;
CREATE POLICY build2_rollback_owner ON public.build2_rollback_candidates
 FOR SELECT TO authenticated USING (owner_id=auth.uid());
REVOKE SELECT ON public.build2_rollback_candidates FROM anon;
REVOKE SELECT ON public.build2_rollback_view FROM anon;
ALTER VIEW public.build2_rollback_view SET (security_invoker=true);
DO $check$
BEGIN
 IF has_table_privilege('anon','public.build2_rollback_candidates','SELECT')
 THEN RAISE EXCEPTION 'migration did not revoke table access'; END IF;
 IF has_table_privilege('anon','public.build2_rollback_view','SELECT')
 THEN RAISE EXCEPTION 'migration did not revoke view access'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='build2_rollback_view'
 AND 'security_invoker=true'=ANY(reloptions)) THEN
 RAISE EXCEPTION 'migration did not set security_invoker'; END IF;
END $check$;
ROLLBACK TO SAVEPOINT build2_pre_migration;
RELEASE SAVEPOINT build2_pre_migration;
COMMIT;
DO $check$
BEGIN
 IF NOT has_table_privilege('anon','public.build2_rollback_candidates','SELECT')
 THEN RAISE EXCEPTION 'rollback failed to restore table grant'; END IF;
 IF NOT has_table_privilege('anon','public.build2_rollback_view','SELECT')
 THEN RAISE EXCEPTION 'rollback failed to restore view grant'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='build2_rollback_candidates'
 AND policyname='build2_rollback_legacy') THEN RAISE EXCEPTION 'rollback failed to restore legacy policy'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='build2_rollback_candidates'
 AND policyname='build2_rollback_owner') THEN RAISE EXCEPTION 'rollback retained new policy'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE relname='build2_rollback_view'
 AND 'security_invoker=true'=ANY(coalesce(reloptions,ARRAY[]::text[]))) THEN
 RAISE EXCEPTION 'rollback retained view security_invoker setting'; END IF;
END $check$;
SELECT 'PASS: disposable transactional rollback restores original policy, anon grants and view security options' AS result;
