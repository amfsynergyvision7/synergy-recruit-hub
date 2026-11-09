# All 13 live view definitions — read-only security triage (2026-11-10)

Source: authorized read-only `pg_get_viewdef` catalog inspection of all 13 `public` views. No underlying CRM rows read.

| View | Observed definition pattern | Review priority |
| --- | --- | --- |
| available_recruiters | profiles with status approved; constant Available label; no is_active predicate | High: inactive account semantics |
| candidates_for_assignment | candidates with assignment-status CASE and order | High: unassigned candidates must not leak |
| recruiter_performance | profiles LEFT JOIN candidates, per-stage counts and conversion | High: aggregation and inactive profile |
| recruiter_performance_with_names | profiles LEFT JOIN candidates, placement and interview counts | High: aggregation and inactive profile |
| recruiter_stats | profiles LEFT JOIN candidates, conversion/counts | High: aggregation and inactive profile |
| recruiter_summary | profiles LEFT JOIN candidates, hires/lost/active pipeline | High: aggregation and inactive profile |
| vw_billing_filters | direct billing projection including financial columns | Critical: finance authorization |
| vw_candidate_filters | direct candidate projection | High: recruiter ownership |
| vw_client_filters | direct clients projection | High: client confidentiality |
| vw_interview_filters | direct interviews projection including feedback | High: candidate relationship |
| vw_job_filters | direct job_openings projection | High: recruiter ownership |
| vw_offer_filters | direct offers projection including salary and CTC | Critical: financial confidentiality |
| vw_submission_filters | direct submissions projection | High: candidate relationship |

**Verified observation:** All five recruiter/profile listing or aggregate views (`available_recruiters`, `recruiter_performance`, `recruiter_performance_with_names`, `recruiter_stats`, `recruiter_summary`) filter `p.status='approved'` or `status='approved'`, but not `is_active=true` in the view SQL. Whether inactive profiles are actually visible depends on underlying RLS and view security mode; do not claim a demonstrated leak.

**Design decision needed before production:** decide whether recruiter reporting is admin-only (recommended default pending application role mapping) or recruiter-visible with strictly scoped aggregates. `security_invoker=true` requires base-table SELECT grants and RLS, and may break existing reports; privileged views currently bypass underlying RLS by default.

**Next isolated checks:** actual-expression-shaped aggregates for multiple recruiter identities, missing identity, inactive approved profiles; projection access tests for offer, billing and client data; check no residual permissive policies; test migration/rollback. No live DDL/DML, no merge or deploy, nine release gates blocked.
