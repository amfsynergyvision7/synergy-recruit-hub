-- BUILD48 EMERGENCY RESTORATION REHEARSAL ONLY. UNSAFE FOR PRODUCTION.
-- Restores 67 previously vulnerable policies and anonymous privileges.
-- DO NOT EXECUTE IN PRODUCTION/STAGING OR AS STANDARD ROLLBACK.
-- Requires "build48.disposable_recovery=on" solely in disposable CI transactions.
-- The legacy permissions are insecure and this is NOT an approved recovery plan.
BEGIN;
DO $recovery_pre$
DECLARE n integer;
BEGIN
 IF current_setting('build48.disposable_recovery',true)<>'on' THEN
    RAISE EXCEPTION 'Recovery SQL may only run inside an explicit disposable test session';
 END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
 IF n<>35 THEN RAISE EXCEPTION 'Expected exactly 35 review policies before recovery, found %',n; END IF;
END $recovery_pre$;
DO $drop_review$
DECLARE p record;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies
 WHERE schemaname='public'
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
END $drop_review$;
-- BUILD48 READ-ONLY LIVE 67-POLICY DEFINITION SNAPSHOT (2026-11-11).
-- REPRODUCE IN SYNTHETIC CI DATABASE ONLY. NOT an active migration.
CREATE POLICY "admin update app settings" ON public."app_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "public read app settings" ON public."app_settings" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow all for authenticated" ON public."audit_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert audit" ON public."audit_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "read audit" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."billing" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete bill" ON public."billing" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert bill" ON public."billing" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "read bill" ON public."billing" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update bill" ON public."billing" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."candidate_activities" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "read activities" ON public."candidate_activities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."candidates" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete candidates" ON public."candidates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert candidates" ON public."candidates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read candidates" ON public."candidates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update candidates" ON public."candidates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."clients" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete clients" ON public."clients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert clients" ON public."clients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read clients" ON public."clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update clients" ON public."clients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "insert email_log" ON public."email_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read email_log" ON public."email_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "Allow all for authenticated" ON public."google_integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert own google integration" ON public."google_integrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin select own google integration" ON public."google_integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin update own google integration" ON public."google_integrations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((user_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."integrations" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin read integrations" ON public."integrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin write integrations" ON public."integrations" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."interviews" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete int" ON public."interviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert int" ON public."interviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read int" ON public."interviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update int" ON public."interviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."job_openings" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete jobs" ON public."job_openings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert jobs" ON public."job_openings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read jobs" ON public."job_openings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update jobs" ON public."job_openings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."notifications" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert notif" ON public."notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "read notif" ON public."notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
CREATE POLICY "update notif" ON public."notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) OR (user_id IS NULL)));
CREATE POLICY "Allow all for authenticated" ON public."offers" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete off" ON public."offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert off" ON public."offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role) OR has_role(auth.uid(), 'operations'::app_role)));
CREATE POLICY "read off" ON public."offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update off" ON public."offers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."profiles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin delete profiles" ON public."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update profiles" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "approved read profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_approved(auth.uid()) OR (auth.uid() = id)));
CREATE POLICY "self update profile" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id));
CREATE POLICY "Allow all for authenticated" ON public."submissions" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "delete subs" ON public."submissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insert subs" ON public."submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "read subs" ON public."submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_approved(auth.uid()));
CREATE POLICY "update subs" ON public."submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'recruiter'::app_role)));
CREATE POLICY "Allow all for authenticated" ON public."sync_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin insert sync logs" ON public."sync_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin read sync logs" ON public."sync_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow all for authenticated" ON public."user_roles" AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "admin manage roles" ON public."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "self read role" ON public."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "admin manage workflow rules" ON public."workflow_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- READ-ONLY source snapshot direct API grants: 32 table/view objects, 3 API roles.
REVOKE ALL ON TABLE public."app_settings" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."app_settings" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."audit_logs" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."audit_logs" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."available_recruiters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."available_recruiters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."billing" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."billing" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidate_activities" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidate_activities" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidate_stage_history" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidate_stage_history" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidates" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidates" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."candidates_for_assignment" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."candidates_for_assignment" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."clients" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."clients" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."email_log" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."email_log" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."google_integrations" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."google_integrations" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."integrations" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."integrations" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."interviews" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."interviews" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."job_openings" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."job_openings" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."notifications" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."notifications" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."offers" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."offers" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."profiles" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."profiles" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_performance" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_performance" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_performance_with_names" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_performance_with_names" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_stats" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_stats" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."recruiter_summary" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."recruiter_summary" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."submissions" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."submissions" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."sync_logs" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."sync_logs" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."user_roles" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."user_roles" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_billing_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_billing_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_candidate_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_candidate_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_client_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_client_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_interview_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_interview_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_job_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_job_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_offer_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_offer_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."vw_submission_filters" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."vw_submission_filters" TO anon,authenticated,service_role;
REVOKE ALL ON TABLE public."workflow_rules" FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE public."workflow_rules" TO anon,authenticated,service_role;
-- Restore thirteen view security options from production catalog.
ALTER VIEW public."available_recruiters" RESET (security_invoker);
ALTER VIEW public."candidates_for_assignment" RESET (security_invoker);
ALTER VIEW public."recruiter_performance" RESET (security_invoker);
ALTER VIEW public."recruiter_performance_with_names" RESET (security_invoker);
ALTER VIEW public."recruiter_stats" RESET (security_invoker);
ALTER VIEW public."recruiter_summary" RESET (security_invoker);
ALTER VIEW public."vw_billing_filters" RESET (security_invoker);
ALTER VIEW public."vw_candidate_filters" RESET (security_invoker);
ALTER VIEW public."vw_client_filters" RESET (security_invoker);
ALTER VIEW public."vw_interview_filters" RESET (security_invoker);
ALTER VIEW public."vw_job_filters" RESET (security_invoker);
ALTER VIEW public."vw_offer_filters" RESET (security_invoker);
ALTER VIEW public."vw_submission_filters" RESET (security_invoker);
-- Restore sixteen real SECURITY DEFINER function signatures and caller grants.
REVOKE ALL ON FUNCTION public."generate_reminders"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."generate_reminders"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."generate_reminders"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."get_user_role"(_user_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."get_user_role"(_user_id uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."get_user_role"(_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public."handle_new_user"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."has_role"(_user_id uuid, _role app_role) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."has_role"(_user_id uuid, _role app_role) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."has_role"(_user_id uuid, _role app_role) TO PUBLIC;
REVOKE ALL ON FUNCTION public."is_approved"(_user_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."is_approved"(_user_id uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."is_approved"(_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public."on_candidate_stage_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_candidate_stage_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_interview_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_interview_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_offer_change"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_offer_change"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."on_submission_insert"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."on_submission_insert"() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_candidate_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_candidate_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_client_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_client_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."resolve_job_uuid"(_value text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."resolve_job_uuid"(_value text) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public."rls_auto_enable"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."rls_auto_enable"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."run_workflow_rules"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."run_workflow_rules"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."run_workflow_rules"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."set_assigned_recruiter"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."set_assigned_recruiter"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."set_assigned_recruiter"() TO PUBLIC;
REVOKE ALL ON FUNCTION public."track_stage_changes"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."track_stage_changes"() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."track_stage_changes"() TO PUBLIC;
ALTER FUNCTION public.set_assigned_recruiter() RESET search_path;
ALTER FUNCTION public.track_stage_changes() RESET search_path;
REVOKE ALL ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO PUBLIC,anon,authenticated,service_role;
DO $recovery_assert$
DECLARE n integer;digest text;
BEGIN
 SELECT count(*),md5(string_agg(
 tablename||E'\x1f'||policyname||E'\x1f'||permissive||E'\x1f'||
 roles::text||E'\x1f'||cmd||E'\x1f'||coalesce(qual,'<NULL>')||E'\x1f'||coalesce(with_check,'<NULL>'),
 E'\n' ORDER BY tablename,policyname))
 INTO n,digest FROM pg_policies WHERE schemaname='public';
 IF n<>67 OR digest<>'a70190f31ed8436b2989082898a02b51' THEN
  RAISE EXCEPTION 'Recovered policy fingerprint mismatch %/%',n,digest; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='v' AND has_table_privilege('anon',c.oid,'SELECT')
 AND NOT (coalesce('security_invoker=true'=ANY(c.reloptions),false))
 AND c.relname=ANY(ARRAY['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters']);
 IF n<>13 THEN RAISE EXCEPTION 'Recovered view privileges mismatch %',n; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
 AND p.proname=ANY(ARRAY['generate_reminders','get_user_role','handle_new_user','has_role','is_approved','on_candidate_stage_change','on_interview_change','on_offer_change','on_submission_insert','resolve_candidate_uuid','resolve_client_uuid','resolve_job_uuid','rls_auto_enable','run_workflow_rules','set_assigned_recruiter','track_stage_changes']);
 IF n<>16 THEN RAISE EXCEPTION 'Recovered privileged function count mismatch %',n; END IF;
END $recovery_assert$;
COMMIT;
-- THIS RESTORES THE INSECURE LEGACY BASELINE. A production release needs
-- a reviewed BACKUP RESTORE and safer roll-forward remediation strategy.
