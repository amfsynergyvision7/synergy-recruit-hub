# Build 46 — Transactional Drive Import, Source File Ledger, Release Hold

## Implementation (draft branch only)
- New review-only PostgreSQL `crm_commit_drive_resume_import` and `crm_list_drive_imported_file_ids` functions, with private `crm_private.drive_resume_import_ledger` keyed globally by Drive file ID. Source folder must match the admin's `app_settings.resume_import_folder_url`; owner must be approved/active admin, assigned recruiter approved/active; only `service_role` can execute either RPC.
- Candidate create/update + ledger write are atomic per Drive file and competing workers are serialized with **the same advisory lock namespace as the Sheets import**. Existing email/mobile/name/role/other populated fields are protected; uncertain extraction and conflicting candidates are refused rather than overwritten. No automatic stage or billing changes.
- Each Drive file is replay-safe with a fingerprint; a modified file or different folder is rejected. A legacy URL pointing to a file without an entry in the new ledger is blocked for manual reconciliation. No file bytes or resume text are persisted to this ledger.
- `src/lib/drive-import.server.ts` no longer issues direct candidate insert/update queries. The draft application adapter calls the two service-only RPCs, preserves the bounded parser pipeline (20 files/run, max 5 concurrent) and reports failures without exposing credentials/SQL internals. The authenticated admin server function now passes the actual owner user ID.
- **The unconditional server-side pause `assertDriveBulkImportReviewed()` is deliberately retained.** A code/config change plus independent approval, migration, actual integration credentials and tests are needed before Drive import can run.

## Evidence
- Nonproduction Supabase isolated rollback-only SQL: approved-role/folder checks, invalid fields, pending/inactive recruiter, candidate-identity ambiguity, original values preservation, candidate insert/ledger fault rollback, same file replay, legacy-URL refusal and restricted ledger read; PASS, with no persistent tables.
- Source-derived trigger fixture: seven read-only current production trigger function bodies and nine trigger attachments, synthetic Drive candidate create/update, assignment, code and ledger consistency; PASS after adding the original production candidate primary-key constraint to the simplified fixture.
- GitHub CI reruns all prior security, source-shaped RLS, GoTrue signed HTTP, application build, concurrency/restore and financial hold checks.

## Still blocked
The project has **zero hosted nonproduction Auth test identities**, no formally accepted 140-case hosted/browser UAT, 0/48 production security objects remediated and 0/9 formal release gates. Main is unprotected and neither PR has independent review. Existing manual candidate writes can still race the import RPC because candidate email/mobile have no unique indexes. Legacy imported Drive URLs need an audited reconciliation plan. This test fixture does not cover every real production constraint or run real Drive/Gemini calls. Finance/legal/management must separately approve any billing policy change.

Production release remains HOLD; no production writes, merge, cron or financial workflow activation.
