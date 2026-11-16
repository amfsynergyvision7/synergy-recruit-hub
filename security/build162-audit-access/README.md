# Build 162 — Audit access, producer inventory and release HOLD

**DRAFT ONLY — DO NOT APPLY / MERGE / DEPLOY / EMAIL.** PR #18 review branch only, no live SQL or hosted data changes. All hard CRM email, reconciliation and financial release holds remain in force.

## Material changes
1. The read-only audit permission preflight now checks effective anonymous and authenticated TRUNCATE privileges, refusing the candidate state even when other DML was revoked.
2. In the existing disposable PostgreSQL 17 transaction, actual SQL-role tests deny anonymous SELECT and every mutation, deny all authenticated mutations, and distinguish an ordinary viewer from a synthetic active approved administrator for SELECT. The one synthetic admin RLS policy is lab-only: this does not prove real Auth JWT enforcement or production's exact approved read-audit policy.
3. A new single-SELECT catalog inventory names public/private functions whose stored definitions mention audit_logs, triggers directly on the audit table or invoking such functions, and views with database dependencies on that relation. It returns identifiers/counts only, **not** routine bodies or audit/business records. It is intentionally review-only, not a clearance: SQL constructed dynamically, helper-call chains, other schemas, external integrations, scheduled jobs, provider activity and historic writers remain unverified.
4. Six new contract tests run in PR #18's existing no-secret workflow; the role-level SQL tests run only in its disposable PostgreSQL service.

## Mandatory independent gates
The DB/security owner must evaluate actual external exposure, effective grants, policy expression and all event producers; review backup/rollback, admin reader compatibility and controlled staging UAT before applying a permission migration. The CRM, HR and communications owners must approve hosted fake-provider reconciliation and audit evidence. An authorized GitHub administrator must protect main; a separate eligible reviewer must approve PR #15 and later review PRs #16/#18/#12. The agent does not self-approve independent signoffs.

Current source-only changes **close no independent milestone**: preserve formal 26/100 weighted readiness, 31 open milestones, 0/48 accepted live security objects, 0/140 signed hosted UAT cases and 0/9 final signoffs until verifiable acceptance.
