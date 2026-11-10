# Live view-definition dependency classification — 2026-11-10

Source: read-only `pg_views.definition` metadata for all 13 public views. No business rows queried.

| View | Base data | Sensitive fields or behavior | Required test |
|---|---|---|---|
| available_recruiters | profiles | recruiter ID, full name, email; only `status='approved'`, not `is_active` | inactive recruiter visibility, anonymous denial |
| candidates_for_assignment | candidates | candidate code, name, position, stage, assigned recruiter | cross-recruiter assignment visibility; admin assignment UI |
| recruiter_performance | profiles + candidates | recruiter name/email and candidate stage aggregates | approved admin report; recruiter aggregate isolation |
| recruiter_performance_with_names | profiles + candidates | recruiter identity, placement counts and conversion | admin report; recruiter isolation |
| recruiter_stats | profiles + candidates | recruiter identity and candidate aggregates | admin/recruiter reporting |
| recruiter_summary | profiles + candidates | recruiter name and candidate pipeline counts | admin/recruiter reporting |
| vw_billing_filters | billing | salary, placement fee, GST, invoice, outstanding balance | finance/admin only; deny recruiter/anon |
| vw_candidate_filters | candidates | candidate code, full name, location, assigned recruiter | ownership filtering |
| vw_client_filters | clients | company name, contact person, agreement and billing model | authorized client access only |
| vw_interview_filters | interviews | candidate/client IDs, interview feedback | ownership filtering |
| vw_job_filters | job_openings | job title, assigned recruiter | ownership filtering |
| vw_offer_filters | offers | salary, CTC, joining status | compensation access policy |
| vw_submission_filters | submissions | candidate/client/job IDs and remarks | ownership filtering |

## Verified structural findings
- `vw_*_filters` views are direct projections from one base table; they inherit its effective permissions when converted to `security_invoker=true`.
- Recruiter performance views aggregate `profiles` and `candidates`. With security-invoker semantics, row-level restrictions can alter aggregates and potentially break dashboards; compare synthetic expected results for each role.
- `available_recruiters` filters approved profile status but does not explicitly filter `is_active=true`. It also includes email addresses; anonymous visibility should be denied.
- `candidates_for_assignment` exposes candidate names and pipeline status without an ownership predicate in the view itself; currently the view is not marked security-invoker.
- `vw_billing_filters` exposes compensation and financial data directly from billing. Confirm that only authorized finance/admin accounts can access it.

## Release criteria
1. Test all 13 views as anon, pending, suspended, recruiter, operations, finance, admin and service roles using synthetic records.
2. Verify that `security_invoker=true` and underlying table RLS restrict every view to the intended records, and that aggregates do not expose cross-recruiter information.
3. Reconcile UI usage of recruiter performance, assignment and filter views before altering privileges.
4. Do not publish or deploy this review-only change until the tested table-policy replacement and view hardening are deployed together.

**State:** definition inventory and test specification complete; execution and production remediation pending.
