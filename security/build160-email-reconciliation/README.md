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

## Build163 — complete PostgreSQL 17 table privilege assessment (review only)

Fresh production catalog-only verification found additional effective table-level `REFERENCES`, `TRIGGER`, `MAINTAIN` grants to **anon**, **authenticated**, and **service_role**. PostgreSQL 17 supports all three; row-level security does not protect whole-table operations such as `TRUNCATE` and `REFERENCES`. The Build161 lockdown only revoked SELECT/DML/TRUNCATE, leaving these documented grants. Build163 adds one extra **DO-NOT-APPLY** REVOKE statement for these three permissions, covering every non-owner application role, and extends the read-only gate to refuse any effective grant that remains. The separately reviewed admin-only SELECT policy is now checked by its exact production-catalog expression, not loose keyword matching.

The existing disposable PG17 trusted-journal fixture now recreates all nine extra grants before running the exact reviewed SQL and checks every effective privilege is absent afterwards. A second source-controlled read-only `security/build163-audit-grants/audit-grant-matrix.readonly.sql` enumerates permission and owner/bypass status only; it does not touch audit records. Owner `postgres` and `service_role` BYPASSRLS remain separate critical risks; a permission REVOKE is not a complete immutable/WORM audit solution. DBA must review owner break-glass, backups and operational producers. Do not install the audit lockdown in isolation from PR #16 or before independent security acceptance.

## Build161 — source producer inventory and append-only audit permissions

A source-wide repository CI scan checks every `src/**/*.ts(x)` application file for direct literal `audit_logs` access and fails if any direct writer or unreviewed reference is added. The currently inspected audit viewer is explicitly read-only, with a bounded admin-gated metadata projection; the Supabase generated types are an expected schema reference. **This inventory does not prove there are no dynamic SQL or external writers**; a separate production pg_catalog function/trigger metadata audit found no existing public/private function definition referencing `audit_logs`, and qualified owners must still inspect integrations, external scripts and history.

The previous source-only lockdown is strengthened: `anon` loses SELECT as well as DML access, `authenticated` retains SELECT for the existing admin-only RLS reader but loses direct writes, and **`service_role` retains INSERT but loses UPDATE, DELETE and TRUNCATE** to prevent ordinary server credentials from rewriting audit history. Owner-level PostgreSQL superusers remain a separately governed break-glass risk.

The isolated PG17 fixture deliberately grants service-role UPDATE/DELETE/TRUNCATE before running the reviewed lockdown, then uses `SET LOCAL ROLE service_role` to attempt actual UPDATE, DELETE and TRUNCATE, requiring permission-denied for all three while the originally appended event remains present. The new source-controlled READ-ONLY production preflight checks anonymous SELECT, authenticated admin reader, server append-only permissions and RLS enabled; **it is not permission to deploy**. The existing browser viewer must continue to work after a separately approved, tested migration; any unknown audit writers must be refactored first.

Build161 also makes the read-only catalog gate fail closed on **any extra or missing audit policy**: the independently reviewed candidate must retain exactly one authenticated admin-only `read audit` SELECT policy and zero other audit policies. A future legitimate policy addition requires qualified owner review and an updated source fingerprint; it cannot silently pass merely because the old PUBLIC ALL rule was removed.
