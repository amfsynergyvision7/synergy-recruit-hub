# Live database view-exposure inventory — 2026-11-09
Read-only PostgreSQL catalog inspection; no CRM business rows read or changed.

**Finding:** All 13 public views below have `anon SELECT = true`, `authenticated SELECT = true`, and `reloptions = NULL` (no `security_invoker=true`). A view owned by a privileged role can bypass underlying RLS. This is a confirmed *authorization design exposure*, not proof of unauthorized data exfiltration.

| View | anon SELECT | authenticated SELECT | security_invoker |
| --- | --- | --- | --- |
| available_recruiters | yes | yes | not enabled |
| candidates_for_assignment | yes | yes | not enabled |
| recruiter_performance | yes | yes | not enabled |
| recruiter_performance_with_names | yes | yes | not enabled |
| recruiter_stats | yes | yes | not enabled |
| recruiter_summary | yes | yes | not enabled |
| vw_billing_filters | yes | yes | not enabled |
| vw_candidate_filters | yes | yes | not enabled |
| vw_client_filters | yes | yes | not enabled |
| vw_interview_filters | yes | yes | not enabled |
| vw_job_filters | yes | yes | not enabled |
| vw_offer_filters | yes | yes | not enabled |
| vw_submission_filters | yes | yes | not enabled |

## Required release strategy
1. Enumerate definitions, dependencies, and actual frontend/edge-function callers without reading business rows.
2. For private views, revoke `SELECT` from `anon` after caller verification; verify effective permissions via `has_table_privilege` because grants through `PUBLIC` may remain.
3. For authenticated views, prefer `ALTER VIEW public.<view> SET (security_invoker = true)` on PostgreSQL 15+ **only after** the underlying RLS policies and caller column privileges are tested. This may break existing filters and reporting, especially `vw_billing_filters`.
4. Views used as option lists must avoid exposing private candidate names or finance details to unauthorized roles; security_invoker alone does not provide field-level masking.
5. Test negative access for anon, pending, inactive, recruiter A/B, Operations, Viewer and Finance; include all view callers in regression tests.
6. Only then stage an audited, reversible migration. Never run blanket `ALTER VIEW` or `REVOKE` directly against live production before validation.

**Status:** inventory complete; hardening not executed; production unchanged. No paid resource created.
