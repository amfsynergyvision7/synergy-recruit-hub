# Free-path CRM security remediation: exact policy inventory and migration order
Date: 2026-11-09. Source: live `pg_policies` **metadata only** (no business records accessed). Production SQL **not executed**.

## Critical confirmed condition
Each of the following **15** tables currently has `"Allow all for authenticated"` with `TO PUBLIC`, `FOR ALL`, `USING true`, `WITH CHECK true`:
`audit_logs`, `billing`, `candidate_activities`, `candidates`, `clients`, `google_integrations`, `integrations`, `interviews`, `job_openings`, `notifications`, `offers`, `profiles`, `submissions`, `sync_logs`, `user_roles`.

**Never run the removal-only SQL without a complete reviewed replacement and rollback.** Existing narrower policies are mostly `PERMISSIVE`; dropping the broad policy alone will NOT achieve the intended recruiter-level row isolation.

## Verified legacy policies after broad-policy removal (remaining concerns)
| Table | Existing legacy rules | Security gap / design decision |
| --- | --- | --- |
| audit_logs | Admin-only SELECT and INSERT | Verify immutable append-only log, trusted writer, trigger writes and UPDATE/DELETE grants |
| billing | Approved-user SELECT; Admin/Finance writes | Approved Recruiter/Operations/Viewer can still read financial rows; needs role/record scoping |
| candidate_activities | Approved-user SELECT | No assignment isolation; verify trigger/service insert requirements |
| candidates | Approved-user SELECT; Admin/Recruiter INSERT; Admin/Recruiter/Operations UPDATE | Recruiter cross-record reads and writes, Operations mutation and reassignment; sensitive columns |
| clients | Approved-user SELECT; Admin/Recruiter INSERT/UPDATE | No recruiter-to-client relationship isolation; company contact data |
| google_integrations | Admin + owner SELECT/INSERT/UPDATE | Verify service integration ownership, secrets and delete grants |
| integrations | Admin-only SELECT and ALL | Verify token/URL exposure and privileged sync worker |
| interviews | Approved-user SELECT; Admin/Recruiter INSERT/UPDATE | No candidate/recruiter isolation, unverified Operations interview mapping |
| job_openings | Approved-user SELECT; Admin/Recruiter INSERT/UPDATE | No assignment isolation; confidential jobs and salary fields |
| notifications | Own SELECT; own/Admin INSERT; own/null UPDATE | Null-recipient UPDATE and recipient reassignment require tighter WITH CHECK |
| offers | Approved-user SELECT; Admin/Recruiter/Operations INSERT/UPDATE | Salary/CTC and offer details visible to every approved role |
| profiles | Approved-user or self SELECT; Admin UPDATE/DELETE; self UPDATE | **Critical:** self UPDATE can change `status` and `is_active` unless protected by column permissions/trusted workflow |
| submissions | Approved-user SELECT; Admin/Recruiter INSERT/UPDATE | No linked candidate assignment isolation |
| sync_logs | Admin SELECT/INSERT | Review service-role sync and log contents |
| user_roles | Admin ALL; self or Admin SELECT | Ensure `has_role` is safe, app approval is enforced and role mutation is restricted |

## Mandatory remediation order
1. **Role escalation first.** Lock down `profiles` and `user_roles` through explicit privileged update workflows and column permissions. Existing self-update RLS is insufficient to protect approval and active flags.
2. **Privileged API surfaces.** Inventory 13 owner-privileged views and 16 anonymous-executable SECURITY DEFINER functions. Restrict each after identifying callers and trigger dependencies. Avoid blanket revokes that break auth/bootstrap.
3. **Private tables.** Define per-operation SELECT/INSERT/UPDATE/DELETE policies. Every sensitive SELECT requires an approved active profile and allowed role. For recruiter-scoped entities, require linked assignment. UPDATE must check both old and new row, and column grants must block reassignment.
4. **No unsupported Operations access.** Until an independently verified interview-assignment table exists, deny Operations AI record reads. Do not infer assignment from candidate names or arbitrary user input.
5. **RLS does not hide columns.** Explicitly restrict contact information, resume links, compensation, integration credentials and sensitive profile fields in server projections/privileges. Security-invoker views only where their caller permissions are proven.
6. **Compatibility and negative tests.** Synthetic anon/pending/suspended/Finance/Viewer/Admin/Recruiter A/B tests for CRUD, role elevation, views, RPC, notifications, reporting, recruitment workflows, scheduled sync and rollback.
7. **Production only after verified backup, rollback, test results and release authorization.**

## No-cost execution path
- Keep development and tests on the existing GitHub branch; use Node's built-in test runner (no paid services).
- Use an independently installed local PostgreSQL/Supabase environment if available. This environment currently has Node.js but **no local PostgreSQL or Docker binaries**; thus SQL integration tests are not yet runnable here.
- A live production project must not be used as a substitute for isolated negative tests. Production records must not be used as synthetic fixtures.
- The quoted paid Supabase branch was explicitly declined. **No branch created and no charge incurred.**

## Verification gate
An offline JavaScript test pass does **not** prove RLS behavior. Release remains blocked until Postgres-level tests pass and the resulting SQL can be rolled back. This document records the exact work remaining and prevents a false 'fully fixed' claim.
