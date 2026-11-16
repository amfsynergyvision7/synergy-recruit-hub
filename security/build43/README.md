# Build 43 — Transaction-fenced Google Sheets row commits (REVIEW ONLY)

## Implemented in draft source
- Scheduled synchronization now passes the *same acquired lease UUID* from the server's claim callback to `runCandidateSync`. The scheduled path sets `atomicRowWrites: true`; missing RPC or lease token fails closed, with no fallback to old independent candidate/notification writes.
- Review-only SQL draft `crm_commit_candidate_sync_row` requires an approved, active admin, checks the exact owner/token with a locked unexpired lease, and locks the owner's integration row.
- The RPC combines candidate create/update, a source-row ledger, notification insertion and source cursor advance in a **single PostgreSQL transaction per row**; a forced downstream notification exception rolls back all effects for that row.
- Unique ledger key (integration ID, spreadsheet row number) makes a same-payload replay idempotent; changed source payload or sheet key fails closed. The previous cursor must be ledger-verified; a legacy cursor requires audited backfill or manual reset.
- Co-operating imports serialize through a transaction-scoped advisory lock and recheck expiry at the end of the transaction. Email/mobile ambiguous-match detection rejects conflicts.
- Only synthetic test data in a single rollback-only nonproduction transaction and disposable PostgreSQL 17 CI. No hosted Auth user creation, production/staging writes, schedule activation, real sync, finance flow, merge or deployment.

## Explicit blockers
1. The **manual Google Sheet sync path** and **Drive bulk import path** still have separate writes and may race with manual candidate creation; global uniqueness and a broader import architecture need review.
2. The synthetic candidate table intentionally omits most production triggers. **Workflow, audit, stage history, notification and other real triggers** have not been exercised under this RPC; their side effects may break or duplicate notifications.
3. Existing integrations with non-header, non-ledger-backed cursors will fail safely until reconciled. This requires a migration/backfill plan with restore and checksums.
4. Per-row transactions are atomic, but the entire spreadsheet batch is not; import summaries and `sync_logs` remain outside the row transaction.
5. Source field overwrite semantics and notification message changes are review decisions, not automatically accepted business policy.
6. No real hosted Supabase sign-in/API/browser acceptance or independent security reviewer approval. Formal counters **0/48 production objects remediated**, **0/140 accepted cases**, **0/9 release gates passed**.

**Release status: HOLD.** Nothing in security/build43 is an active production migration.
