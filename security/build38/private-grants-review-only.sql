-- BUILD38 REVIEW-ONLY COMPLEMENT TO 15-TABLE RLS DRAFT.
-- Not an active migration. Do not execute on production or staging.
-- Authenticated column-grant choices and app branding remain compatibility blockers.
BEGIN;
-- RLS never protects TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.app_settings,public.audit_logs,public.billing,public.candidate_activities,public.candidates,public.clients,public.google_integrations,public.integrations,public.interviews,public.job_openings,public.notifications,public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 FROM PUBLIC,anon,authenticated;
-- Private tables: no direct anonymous/PUBLIC data operations.
REVOKE ALL ON public.audit_logs,public.billing,public.candidate_activities,public.candidates,public.clients,public.google_integrations,public.integrations,public.interviews,public.job_openings,public.notifications,public.offers,public.profiles,public.submissions,public.sync_logs,public.user_roles
 FROM PUBLIC,anon;
-- Prevent recruiter ownership changes even when they pass an UPDATE RLS USING clause.
REVOKE UPDATE ON public.candidates,public.job_openings,public.notifications FROM authenticated;
GRANT UPDATE(stage,notes) ON public.candidates TO authenticated;
GRANT UPDATE(status,priority) ON public.job_openings TO authenticated;
GRANT UPDATE(is_read) ON public.notifications TO authenticated;
-- Public branding is an exception: allowlisted read columns only, no writes.
REVOKE ALL ON public.app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,logo_url,default_color_theme) ON public.app_settings TO anon,authenticated;
COMMIT;
-- KNOWN RELEASE BLOCKERS: column grants for real CRM edits and admin role/profile writes;
-- signed JWT/API validation; 19-table/13-view dependencies; 16 function ACLs;
-- app branding compatibility; tested reverse migration, independent approval.
