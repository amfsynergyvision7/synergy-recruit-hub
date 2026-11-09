-- SEC-13 REVIEW ONLY: Supabase security advisor identified 13
-- security-definer views. Tested ALTER VIEW against all 13 in a
-- rolled-back production transaction (13/13 compiled).
-- Requires grants/RLS/runtime compatibility tests before deployment.
alter view public.recruiter_performance_with_names set (security_invoker=true);
alter view public.recruiter_performance set (security_invoker=true);
alter view public.recruiter_summary set (security_invoker=true);
alter view public.candidates_for_assignment set (security_invoker=true);
alter view public.available_recruiters set (security_invoker=true);
alter view public.recruiter_stats set (security_invoker=true);
alter view public.vw_client_filters set (security_invoker=true);
alter view public.vw_interview_filters set (security_invoker=true);
alter view public.vw_offer_filters set (security_invoker=true);
alter view public.vw_job_filters set (security_invoker=true);
alter view public.vw_submission_filters set (security_invoker=true);
alter view public.vw_billing_filters set (security_invoker=true);
alter view public.vw_candidate_filters set (security_invoker=true);
-- Read-only release gate:
select count(*) as invoker_views from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
and c.relname=any(array['recruiter_performance_with_names','recruiter_performance','recruiter_summary','candidates_for_assignment','available_recruiters','recruiter_stats','vw_client_filters','vw_interview_filters','vw_offer_filters','vw_job_filters','vw_submission_filters','vw_billing_filters','vw_candidate_filters'])
and 'security_invoker=true'=any(c.reloptions);
-- Expected: 13 after approved deployment.
