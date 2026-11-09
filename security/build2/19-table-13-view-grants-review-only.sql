-- REVIEW ONLY — NOT TESTED — DO NOT RUN ON PRODUCTION.
-- Proposed defense-in-depth baseline for all 19 inventoried public base tables
-- and all 13 inventoried public views.
-- This is not a standalone migration: table-level authenticated privileges
-- require a reviewed per-table/per-column grant matrix and app compatibility tests.
BEGIN;
-- Anonymous access to private tables is not required by the proposed model.
REVOKE ALL ON
 public.app_settings,public.audit_logs,public.billing,
 public.candidate_activities,public.candidate_stage_history,public.candidates,
 public.clients,public.email_log,public.google_integrations,
 public.integrations,public.interviews,public.job_openings,
 public.notifications,public.offers,public.profiles,public.submissions,
 public.sync_logs,public.user_roles,public.workflow_rules
 FROM anon;
-- SECURITY DEFINER-owned views can bypass base-table RLS.
-- Revoke anon SELECT until minimal public-safe interfaces are designed.
REVOKE ALL ON
 public.available_recruiters,public.candidates_for_assignment,
 public.recruiter_performance,public.recruiter_performance_with_names,
 public.recruiter_stats,public.recruiter_summary,
 public.vw_billing_filters,public.vw_candidate_filters,
 public.vw_client_filters,public.vw_interview_filters,
 public.vw_job_filters,public.vw_offer_filters,
 public.vw_submission_filters
 FROM anon;
-- PostgreSQL 15+ security_invoker option makes views obey the caller's
-- privileges and underlying table RLS; verify ownership and view dependencies.
ALTER VIEW public.available_recruiters SET (security_invoker=true);
ALTER VIEW public.candidates_for_assignment SET (security_invoker=true);
ALTER VIEW public.recruiter_performance SET (security_invoker=true);
ALTER VIEW public.recruiter_performance_with_names SET (security_invoker=true);
ALTER VIEW public.recruiter_stats SET (security_invoker=true);
ALTER VIEW public.recruiter_summary SET (security_invoker=true);
ALTER VIEW public.vw_billing_filters SET (security_invoker=true);
ALTER VIEW public.vw_candidate_filters SET (security_invoker=true);
ALTER VIEW public.vw_client_filters SET (security_invoker=true);
ALTER VIEW public.vw_interview_filters SET (security_invoker=true);
ALTER VIEW public.vw_job_filters SET (security_invoker=true);
ALTER VIEW public.vw_offer_filters SET (security_invoker=true);
ALTER VIEW public.vw_submission_filters SET (security_invoker=true);
COMMIT;
-- RELEASE BLOCKERS: view dependency and app UI testing; public branding
-- replacement; effective PUBLIC grants; base-table RLS replacement;
-- authenticated grant matrix; regression tests for all 13 view results;
-- rollback plan and production release approval.
