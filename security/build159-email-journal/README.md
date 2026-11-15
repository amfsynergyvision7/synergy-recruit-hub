# Build159 — Trusted CRM email reservation + settlement RPCs (REVIEW ONLY)

**DO NOT APPLY / MERGE / SEND EMAIL / DEPLOY.** These are proposed `SECURITY INVOKER`, **service_role-only** PostgreSQL RPCs, separate from migrations. Both compile-time email holds remain on. They have only been prepared for disposable PG17 rehearsal, not accepted or installed in production.

The existing authenticated direct email journal `UPDATE` has no RLS policy, while a proposed 67-to-35 RLS update would remove direct authenticated INSERT. To address this incompatibility **without granting broad authenticated write privileges**, this draft creates the following proposed interfaces:

- `public.crm_email_reserve_trusted` checks the *verified caller-supplied* actor ID against `public.profiles` approved/active state and exactly one admin/recruiter role. It verifies that the CRM record exists, its current email matches the desired recipient, and that recruiter access is limited to assigned candidates (clients are admin-only). It inserts exactly one `pending` journal row, leaving primary-key and the Build158 unresolved-recipient unique index to reject replay or competing attempts.
- `public.crm_email_settle_trusted` accepts only the same journal ID and actor, updating exactly one `pending` row to `sent` with a bounded provider ID or `unknown` without one. No changes of actor, record, subject or email, no status reversal, no automatically retried SMTP.
- Both functions are explicitly **SECURITY INVOKER** (do not assume bypassing RLS), have `search_path = ''`, and **revoke default EXECUTE from PUBLIC, anon and authenticated** before allowing only the trusted `service_role`. The server must not use the browser user's Supabase token with that service connection; no service key may be exposed client-side.

The function uses a service-only role deliberately rather than a public `SECURITY DEFINER` function. Its authorization is a defense-in-depth check, but the privileged service key remains a consequential secret requiring server isolation, auditing and independent review. The SQL is not yet deployed and the app handler does not invoke this new interface until a separate tested integration change.

## Verification and remaining blockers

The `disposable-pg17-trusted-journal.sql` rehearsal creates only synthetic local roles, profiles, records and journal data in a guarded PostgreSQL 17 CI database, imports **the exact draft SQL**, checks unauthorized RPC denial, viewer/suspended/wrong actor/wrong recipient/wrong record rejection, same-ID replay, competing unresolved-recipient lock, correct once-only settlement and unknown-state retention. It ends with `ROLLBACK` and includes no Supabase production secrets or candidate data.

**Important:** Server handlers must still validate the caller's actual authenticated identity; the database cannot infer the web user from a standalone service-role key. This is review-only until the wrapper invokes the RPCs after existing hard holds, approved-role checks and bound-recipient checks. Existing journal rows and index collisions also need explicit owner-approved migration planning; the standalone draft SQL is **not a production migration**.

Required before activation: a full restricted transaction/migration under DBA control, service-key isolation and permissions verification, emergency backout/PITR, provider ID and timeout handling, hosted fictional UAT with assigned recruiters/admins, manual reconciliation, communications/privacy signoff, and independent protected-branch approvals. **0/140 signed hosted cases; 0/48 accepted production fixes; 0/9 final release signoffs.** Issue #17 remains open.

## Build159 draft handler integration

The dependency draft CRM server handler now calls the source-reviewed **`crm_email_reserve_trusted`** and **`crm_email_settle_trusted`** functions through the existing **server-only `supabaseAdmin` client**, after the two immutable email release holds and independent existing auth/role/recipient authorization. The RPCs must still validate those boundaries themselves and only expose a tightly scoped row result. Neither function exists in live production; both will currently fail closed if someone independently disables the release holds without first approving/installing and verifying the complete DB transaction. That does **not** authorize weakening either hard hold. Code integration is still inactive and not end-to-end hosted UAT.

## Build159 read-only independent catalog verification

`trusted-journal-preflight.readonly.sql` queries **only `pg_catalog.pg_proc` and namespace metadata**, never email/candidate rows. It checks both exact function names, expected argument counts, `SECURITY INVOKER`, empty function search paths, no anonymous/authenticated execution grants and restricted `service_role` execution. If absent, mismatched or anonymously exposed, the result is `HOLD_TRUSTED_JOURNAL_RPCS_ABSENT_OR_UNSAFE`. Even a source-compatible result is **review-only** and never permits real email release. It cannot substitute for complete semantic tests and human security approval.
