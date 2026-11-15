# Build158 — Partial unique index for unresolved CRM email attempts

**DRAFT REVIEW ONLY / DO NOT APPLY / DO NOT MERGE / DO NOT SEND EMAIL.**

This focused package extends dependent draft PR #18. It does not modify production/staging databases or install a migration. All permanent change SQL is retained under `security/build158-email-outbox/` as `.sql.txt`, outside `supabase/migrations/`.

## Verified technical intent

The source-confirmed `email_log.id` primary key stops duplicate attempts only when the exact request UUID is reused (Build157). This proposed additional **partial unique index** would lock a *different request UUID* while any `pending` or `unknown` attempt exists for the **same-recipient** address and same `related_table` / `related_id` pair. It normalizes recipient address with `lower(btrim(to_email))` and applies across different senders/actors. Distinct records or recipients remain independent. Once a previous attempt is independently verified `sent`, another deliberately authorized message can be created.

These are pending/unknown duplication controls, **not exactly-once SMTP**, not permanent sent-message dedupe, and not an independently approved policy for how often recruiters may contact people. A failed or unknown provider attempt could represent a delivered email and must block any new attempt until authorized **manual reconciliation**.

## Rehearsal and deployment constraints

- `pending-uniqueness.DO-NOT-APPLY.sql.txt` contains a scoped `CREATE UNIQUE INDEX` statement for independent DBA review. It is **NOT deployed** and MUST NOT be applied alone.
- `disposable-pg17-rehearsal.sql` opens a transaction and refuses any database except `amf_build158_email_lab`. It creates a *synthetic* `public.email_log`, imports the identical review SQL, checks duplicate-key errors across request UUIDs, actors and normalized email case, checks distinct record and recipient behavior, tests the `unknown` hold, and ends in `ROLLBACK`.
- GitHub Actions runs the rehearsal against a fresh disposable PostgreSQL **17** service with hardcoded CI-only fixture credentials and no Supabase or SMTP secrets.
- `pending-index.preflight.readonly.sql` checks only index catalog metadata on authorized production project. Its result is a **HOLD** unless the exact intended unique index exists; even presence would be `REVIEW_ONLY_INDEX_PRESENT_NO_SEND_AUTHORIZATION`, not a release approval.
- **Real production index rollout requires separate DBA approval**, an owner-authorized preflight for existing unresolved collisions (not performed here), a carefully planned low-lock deployment strategy (potentially `CREATE INDEX CONCURRENTLY`, which is prohibited inside a transaction), PITR/restore rehearsal, monitoring, role-restricted audit RPC/outbox, approved backout plan and signed hosted UAT. No one should apply this draft file as written in a live environment.

## Limitations and outstanding owners

- The index would block different request IDs for **same-recipient** / record while unresolved, but not after an acknowledged sent status, for different record/recipient, or if a separate provider duplicates internally.
- Current live `email_log` has **zero authenticated UPDATE policies**. Proposed 67→35 RLS removes direct authenticated INSERT. A role-safe `pending→sent/unknown` RPC or durable outbox with narrow EXECUTE rights remains missing.
- No schema/constraint has been applied to a hosted nonproduction or production tenant. Tests establish disposable PostgreSQL index semantics only. They do not establish production data compatibility, signed 140-case UAT, or domain consent/communications policy.
- Formal counters remain **0/140** signed hosted UAT, **0/48** accepted production security fixes and 0/9 release signatures. Keep issue #17 open; both immutable outbound email holds remain true.

**Owner decision:** DB/security, CRM/operations and communications/privacy reviewers must independently decide whether the conservative unresolved-contact lock meets company requirements, then approve the full migration and manual reconciliation. Business/legal communications policies are not inferred here.
