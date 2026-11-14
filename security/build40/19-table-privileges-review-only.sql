-- BUILD 39 REVIEW-ONLY: extend Build38 column/role grants to all 19 public CRM tables.
-- Do not apply to production/staging until signed-user/UI/trigger/restore gates pass.
BEGIN;
REVOKE ALL ON public.app_settings,public.audit_logs,public.billing,public.candidate_activities,public.candidate_stage_history,public.candidates,public.clients,public.email_log,public.google_integrations,public.integrations,public.interviews,public.job_openings,public.notifications,public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles,public.workflow_rules FROM PUBLIC,anon;
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.app_settings,public.audit_logs,public.billing,public.candidate_activities,public.candidate_stage_history,public.candidates,public.clients,public.email_log,public.google_integrations,public.integrations,public.interviews,public.job_openings,public.notifications,public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles,public.workflow_rules FROM PUBLIC,anon,authenticated;
REVOKE UPDATE ON public.candidates,public.job_openings,public.notifications FROM authenticated;
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT UPDATE(status,priority) ON public.job_openings TO authenticated;
GRANT UPDATE(is_read) ON public.notifications TO authenticated;
REVOKE ALL ON public.app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,logo_url,default_color_theme) ON public.app_settings TO anon,authenticated;
COMMIT;
-- No authenticated full access matrix, server admin UI updates, or grant rollback defined.
