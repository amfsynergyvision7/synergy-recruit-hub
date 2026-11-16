# Build 44 — Manual sync fencing and source-derived trigger compatibility (REVIEW ONLY)

## Actual source changes
- Manual **Sync new rows** now uses the same owner-specific database lease and atomic `crm_commit_candidate_sync_row` RPC as the scheduled path.
- The exported `runCandidateSync` rejects *all* calls without `atomicRowWrites: true`, a lease token, and heartbeat. Legacy multi-call writes remain in dead fallback code but are no longer reachable from this exported entry point.
- Manual **Import full history** and direct cursor reset are blocked until a checked, ledger-consistent reconciliation procedure exists. The UI visibly labels full-history import paused.
- The previous **Drive bulk import** uses concurrent multi-call candidate updates/inserts with no durable Drive-file ledger; it is fail-closed at the server entry before provider access, and the UI marks it paused. This deliberately delays that capability until a safe transactional Drive importer is approved.

## Source-derived compatibility testing
Read-only inspection of current production PostgreSQL metadata (11 November 2026) supplied 239 column definitions across 19 CRM tables, all 7 relevant production trigger function definitions and all 9 candidate/integration trigger attachments. The SQL fixture uses those definitions **without modification**, but simplifies constraints and contains only synthetic rows.

A rollback-only rehearsal on the dedicated hosted nonproduction PostgreSQL session PASS: atomic Sheet candidate create/update, actual candidate-code defaults, stage-history trigger, timestamps, workflow-rules trigger with **no configured rules**, integration mapping, notification count and cursor. The actual service-role assignment trigger uses `auth.uid()`, which is null in this synthetic service-role context: **candidate is unassigned**. Assignment to an approved recruiter must be a separately reviewed business rule, not guessed by the assistant.

## Explicit missing acceptance evidence
- The real workflow rule dataset, its configured actions and nontrivial stage transitions are **not** exercised; neither are all actual production constraints, triggers on other tables, email notifications or financial side effects.
- The 19-table fixture is a simplified catalog-derived replica, **not** a restored production database.
- Hosted Supabase Auth test project has no approved/pending/disabled Auth users and no candidate table; formal real hosted account/API/browser acceptance remains 0/140.
- Drive resume imports remain disabled in this review branch; no claim of feature completion.
- All 48 existing security objects still require reviewed production remediation, and 9 release gates remain unpassed. PRs remain draft/unmerged.

**RELEASE HOLD:** no staging or production database writes, no live imports, no scheduler activation, no PR merge and no financial activation.
