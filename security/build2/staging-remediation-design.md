# Build 2 — staging-ready remediation design (review only)

Date: 2026-11-09. **Not a production-ready migration. Do not deploy.**

## Evidence and risk

The live metadata-only audit identified 15 PUBLIC-targeted permissive ALL policies with USING true and WITH CHECK true, 13 owner-privileged views selectable by anon/authenticated, and 16 anonymous-executable SECURITY DEFINER functions. RLS enabled does not imply effective isolation. Existing legacy grants and policies must be inventoried and tested before altering them.

## Sequenced migration plan (staging only, pending approval)

1. Export schema metadata, pg_policies, grants, view definitions, function definitions, triggers and dependencies into restricted audit evidence. No candidate rows.
2. Verify branch isolation and preview deployment behavior. The repository is public; do not commit keys, personal data, actual profile IDs, business records, SQL dumps with secrets or sensitive environment values.
3. Establish isolated staging database and synthetic-only accounts/records. Confirm staging connection strings are distinct from production.
4. Replace broad PUBLIC ALL policies with narrowly scoped policies, preserving only necessary operations. The current proposal `proposed_rls_restrictions.sql` is a *removal-only draft*, not the complete migration; do not run it as-is in any connected production workflow.
5. For each table, define SELECT/INSERT/UPDATE/DELETE separately. SELECT must enforce approved + active + role + assignment where appropriate; INSERT/UPDATE must use WITH CHECK and prevent ownership/role escalation. RLS is row-based, so sensitive field restrictions require column-level grants, approved security-invoker projections, or server-side explicit column selection.
6. Restrict `profiles` and `user_roles` writes to privileged, audited paths. Do not allow self-service profile changes to alter approval, active status or role. Review application approval workflows.
7. Review all 13 views: identify consumer queries and intended visibility, set security_invoker=true where compatible, or revoke anon/authenticated SELECT and expose narrower safe interfaces.
8. Review all public functions: determine whether RPC-callable vs trigger-only; revoke unnecessary anon EXECUTE, inspect SECURITY DEFINER implementation and trusted search_path. Avoid disabling auth triggers or scheduled reminders without replacement.
9. Validate synthetic permissions at PostgREST/API level and under impersonated role JWTs; no service-role bypass in the AI connector. Confirm existing recruitment workflows and scheduled jobs.
10. Run Supabase advisors, security tests and rollback drill in staging. Only then propose production changes for separate CEO approval.

## Minimum per-table access policy matrix for AI

| Data domain | Admin/CEO | Recruiter | Operations | Finance/Viewer |
| --- | --- | --- | --- | --- |
| Candidates | Approved minimal fields, sensitive gated | Assigned candidate, approved fields | Name only when attached to authorized interview | Deny |
| Interviews | Approved details | Assigned candidate interviews | Explicitly assigned interview details only | Deny |
| Submissions/jobs/clients | Approved minimum | Assigned work context only | Only job title if attached to authorized interview and approved | Deny |
| Offers/billing | Separate approval required | Deny by default for AI | Deny | Deny |
| Profiles/roles/integrations/audit | Separate privileged administrative workflows, not AI connector | Deny | Deny | Deny |

**Operations assignment is unresolved**: no verified relation exists for an authorized Operations user per interview. Proposed contract: an independently managed assignment relation keyed by interview UUID and approved Operations user UUID, with grant/revoke timestamps and admin authorization; default deny when missing. This is a *design proposal*, not an existing CRM column or table.

## Proposed API authorization contract

- Authenticate JWT server-side; recheck profile status='approved' AND is_active=true on each request.
- Resolve app role from trusted server-side role store, not client-supplied role or user_metadata.
- Explicitly authorize request operation and record ID; never accept arbitrary table/column names or SQL.
- Query via user-scoped Supabase client honoring RLS. Never use service-role admin client for AI reads.
- Return a fixed allowlisted JSON schema per role and endpoint. No email, phone, resume or salary for Operations, even via joins, counts, errors or logs.
- Restrict pagination and exports; log metadata only (actor, role, purpose, entity IDs hashed as needed, decision, timestamp).
- All AI actions remain read-only, with no email sending, updates or workflow side effects.

## Verification checklist

- Anonymous SELECT, INSERT, UPDATE, DELETE denied on private tables.
- Pending, rejected, suspended, inactive users denied.
- Recruiter cannot read/update other recruiters' candidate records.
- Operations sees assigned interview and candidate name, never email/phone/resume/salary; unassigned denied.
- Finance and Viewer cannot retrieve individual CRM records through AI.
- Role self-elevation, owner reassignment, unauthorized view/RPC calls denied.
- CRM candidate creation, interviews, offers, scheduling, notifications, reporting and approved admin flows remain functional.
- Security advisor results improve without regressions; rollback works in staging.

## Test evidence

On 2026-11-09 the 21 Node.js synthetic reference-policy tests were executed in an isolated local environment: **21 pass, 0 fail**. This is NOT a staging database or production authorization test.

## Approval gates

Branch preparation and synthetic tests authorized. **Not authorized:** staging resource creation, staging migration execution, production SQL, environment configuration changes, merge, deployment or live record access. Obtain separate scoped approval before each consequential step.
