# Build160 - Independent manual confirmation for uncertain CRM email delivery

**DO NOT APPLY OR MERGE. NO SMTP, PROD OR STAGING WRITES.**

This source-only package adds a conservative recovery path for uncertain delivery after an SMTP timeout or server interruption. It may mark an email as SENT only after an independently approved admin confirms external provider evidence. There is deliberately no FAILED or automatic retry transition.

The proposed SECURITY INVOKER function crm_email_confirm_sent_trusted is restricted to server service_role. It requires an active approved admin with exactly one admin role, **different from the original sender**, a restricted case reference and valid provider message identifier. It locks one PENDING or UNKNOWN journal row, transitions it to SENT and writes an audit_logs event with the previous status, actor, evidence references and original sender **in a single statement transaction**. No message body or recipient address goes into the audit details. Browser roles have no EXECUTE grant.

The independent confirmCrmEmailSent server endpoint derives admin identity from authenticated context, checks the approved admin role and calls the restricted RPC only after an **additional hard-coded reconciliation release hold**. It accepts no admin ID from client input, has no SMTP call and reveals no raw SQL errors.

The disposable PostgreSQL 17 test rehearses the exact proposed SQL and proves that a simulated audit-log write failure rolls back the journal status. It also tests refused self-reconciliation, recruiter/viewer access, invalid case evidence and replay. Synthetic records and functions are rolled back.

**Important limitations:** Case references are not cryptographic proof of provider delivery. An independent human must verify real external evidence and confirm separation of duties. There is no approved process for definitively not-delivered attempts, so they remain locked for review; no auto resend or expiration is approved. Production RPCs and Build158 index are not installed. Full RLS/48-object remediation, provider reconciliation policy, actual auth.users relationships, PITR/restore, hosted fictional tests, privacy/communications and release owner approvals all remain outstanding.

Formal acceptance: **0/140 signed hosted UAT; 0/48 accepted production security fixes; 0/9 final release signatures.** Release issue #17 is OPEN.

## Build160 audit-trail integrity blocker and proposed lockdown

Fresh production metadata-only checks identified **anon and authenticated INSERT, UPDATE and DELETE privileges** on audit_logs and a broad PUBLIC ALL policy with unconditional true expressions. This is a separate HOLD: an audit event is not tamper-resistant if untrusted roles can mutate or forge it.

The file audit-log-lockdown.DO-NOT-APPLY.sql.txt proposes removal of these write grants and existing broad policies. The same source is replayed in disposable PG17 with fictional rows and an intentionally recreated unsafe grant/policy posture, proving untrusted writes are revoked while service_role INSERT remains available. **No live changes were made.**

This proposal can break legitimate existing direct audit writers. Qualified security, database and CRM owners must trace all audit-producing routes, replace any user-side inserts with a restricted verified event interface and reconcile the full PR #16 48-object/67-to-35 RLS redesign before any actual migration. The new audit-integrity.preflight.readonly.sql checks only catalog permission and RPC metadata and returns HOLD if exposed, without inspecting business rows. Even a future matched gate cannot authorize SMTP.
