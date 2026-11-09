-- REVIEW ONLY. NOT TESTED. DO NOT RUN ON PRODUCTION.
-- Incremental hardening proposal for 3 additional tables outside the original 15.
-- Requires isolated PostgreSQL tests, application compatibility checks and rollback.
BEGIN;
-- app_settings: public branding must be provided via a separate minimal interface.
-- Removing anonymous access here can break current public branding UI.
DROP POLICY IF EXISTS "public read app settings" ON public.app_settings;
CREATE POLICY app_settings_approved_read ON public.app_settings
 FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin update app settings" ON public.app_settings;
CREATE POLICY app_settings_approved_admin_update ON public.app_settings
 FOR UPDATE TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- email_log: limit reads to approved admins or the originating sender.
DROP POLICY IF EXISTS "read email_log" ON public.email_log;
CREATE POLICY email_log_scoped_read ON public.email_log FOR SELECT TO authenticated
 USING (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR sent_by=auth.uid()));
DROP POLICY IF EXISTS "insert email_log" ON public.email_log;
CREATE POLICY email_log_approved_insert ON public.email_log FOR INSERT TO authenticated
 WITH CHECK (public.is_approved(auth.uid()) AND
 (public.has_role(auth.uid(),'admin') OR
 (public.has_role(auth.uid(),'recruiter') AND sent_by=auth.uid())));
-- workflow_rules: only approved admins may manage rules.
DROP POLICY IF EXISTS "admin manage workflow rules" ON public.workflow_rules;
CREATE POLICY workflow_rules_approved_admin ON public.workflow_rules FOR ALL TO authenticated
 USING (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'))
 WITH CHECK (public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin'));
-- Explicitly remove anonymous table grants; validate branding and triggers first.
REVOKE ALL ON public.app_settings,public.email_log,public.workflow_rules FROM anon;
COMMIT;
-- BLOCKERS: app branding replacement, workflow rule field allowlist,
-- email-log sender trust, RLS OR composition, grants inherited from PUBLIC,
-- SECURITY DEFINER view/RPC access and actual database tests.
