# Build 45 — Explicit recruiter assignment and financial-automation release HOLD

**Implementation scope:** isolated review branch only. No merge, staging/production database writes, real candidate sync or activated financial workflow.

## Fixed in the review draft
- The Google Sheets atomic sync RPC now requires a sixth UUID parameter, `p_assigned_recruiter`. It validates that the identity has an approved, active profile with the recruiter role. New candidate inserts explicitly assign this verified identity rather than falling back to the service-role `auth.uid()` (which is null). Existing candidate assignments remain unchanged on updates.
- The server supplies the recruiter UUID exclusively from `CANDIDATE_SYNC_ASSIGNED_RECRUITER_ID`, a **server-side environment variable deliberately unset until business approval**. A missing or invalid UUID fails closed *before reading the sheet*. No credentials or names are embedded.
- Manual sync additionally requires `CANDIDATE_SYNC_MANUAL_ENABLED=true`; without it, the server denies manual imports. The manual UI is paused. Reported per-row errors are surfaced as errors instead of a misleading success state. Cron retains its separate feature flag and bearer verification.
- The Build43 and Build44 SQL fixtures, API and concurrency/restore fixtures, grant signatures and emergency halt are updated for the six-argument RPC. Tests reject pending, inactive or missing recruiter assignments, and assert a new candidate receives only the approved recruiter.

## Source-derived financial risk — confirmed, not activated
The actual production `on_candidate_stage_change` trigger automatically creates a billing record when the stage becomes `joined`, using `placement_fee = ROUND(salary * 0.0833,2)` and `GST = ROUND(fee*0.18,2)`. A disposable rollback-only replica demonstrates this behavior and a configured synthetic workflow notice using **no real candidates or invoices**. The production database currently has **zero configured workflow rules**. The financial trigger nevertheless exists.

A separate SQL proposal `financial-automation-hold-review-only.sql` preserves other existing stage handlers but suppresses joined-stage billing. A separate rollback rehearsal asserts this suppresses the bill and still permits a stage change and synthetic workflow notice. **This is one proposal for finance/legal/management approval, not an active migration or a chosen company policy.** Do not execute it on a hosted database without reviewed approval, backup and tests.

## Explicit outstanding release gates
1. Hosted nonproduction Supabase Auth synthetic users: none currently exist; 0/140 independently accepted hosted/UI cases. Disposable GoTrue tests do **not** count as this acceptance.
2. Full approved release-plan reconciliation for the 48 production security objects, actual PostgreSQL constraints and available backup/restore.
3. Signed business decision identifying who is eligible to be assigned to imported candidates, how existing unassigned records are handled, and whether stage-joined billing is permitted.
4. Drive bulk importer remains deliberately paused; durable Drive file ledger, concurrency and import recovery are unimplemented.
5. Sync ledger backfill for existing cursors, event/trigger interactions, source-only side effects, reliable error audit and manual on/off policy need independent review.
6. Main branch remains unprotected; 0 independent reviews and 0/9 formal release gates passed; both PRs remain draft.
7. Six Command Center business workstreams are not formally signed off.

**Release status: HOLD.** Forecasting a fixed number of further builds would be misleading until these external acceptance decisions have owners and evidence.
