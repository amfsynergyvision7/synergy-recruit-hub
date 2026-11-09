# Live view ownership and privilege verification — 2026-11-10

Read-only `pg_class`, `pg_namespace`, `pg_get_userbyid` and `has_table_privilege` metadata query on the existing Supabase project; no CRM row reads and no production modifications.

**Verified for all 13 public views:**
- Owner: `postgres`
- `reloptions`: NULL, so `security_invoker=true` is not configured
- `anon`: effective SELECT privilege = true
- `authenticated`: effective SELECT privilege = true

Views: `available_recruiters`, `candidates_for_assignment`, `recruiter_performance`, `recruiter_performance_with_names`, `recruiter_stats`, `recruiter_summary`, `vw_billing_filters`, `vw_candidate_filters`, `vw_client_filters`, `vw_interview_filters`, `vw_job_filters`, `vw_offer_filters`, `vw_submission_filters`.

**Security implication:** PostgreSQL views without `security_invoker=true` normally evaluate underlying relation access as the view owner. Since `postgres` owns all 13, do not assume base-table RLS protects queries through these views. Actual API exposure depends on schema exposure and other Supabase settings; an exploitation test has not been performed.

**Required next step:** In isolated PostgreSQL, test each view before and after setting `security_invoker=true`, as anon and each app role, with synthetic records. Validate expected UI use and underlying base-table grants. The review-only SQL is not a production deployment artifact.

**Status:** View ownership verification completed; integration tests and remediation remain blocked.
