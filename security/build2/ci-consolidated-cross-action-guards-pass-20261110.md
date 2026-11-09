# Consolidated draft-safe CRM mutation concurrency batch — 2026-11-10

## Scope
Batch changes on the unmerged draft branch only:
1. Prevent single-record save/delete while a bulk mutation is in flight.
2. Prevent bulk edit/delete while a single-record mutation is in flight.
3. Prevent checkbox bulk selection changes while bulk mutation batches are in flight.
4. Update existing single and bulk concurrency static assertions to the cross-action guards.
5. Add consolidated regression coverage in `security/build2/crud-cross-action-batch-guards.test.mjs`.

## Verification
GitHub Actions run #344: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42700064312

All three jobs passed: application build/TypeScript, offline security tests, isolated PostgreSQL. These are static/offline and build checks, not role-based browser tests.

## Remaining authorisation gates
No staging migration or rollback, no role-based browser E2E, no production RLS remediation, no financial workflow activation, no policy approval, no merge or deployment. PR #11 remains unmerged and all nine production release gates remain false.

Further work requiring separate explicit management authorisation: staging environment access/write and rollback execution; real-role test accounts and browser tests; legal/finance approval of fee, GST and workflow policies; production release approval. Continue independent draft-safe code reviews in grouped batches where warranted.
