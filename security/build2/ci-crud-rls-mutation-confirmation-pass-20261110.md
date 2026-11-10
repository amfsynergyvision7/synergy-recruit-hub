# Shared CRUD RLS mutation confirmation — verified 2026-11-10

Draft application fix: `src/components/CrudModule.tsx`, commit `3aa36097ff8aec91030ef42f2bfef166df1714fd`.

The previous shared CRUD implementation showed success when Supabase returned no error, even when an RLS-filtered UPDATE or DELETE affected zero rows. Bulk mutations also reported the selected count, not confirmed affected records.

**Changes on unmerged branch:** single INSERT/UPDATE/DELETE now requests `select('id')` and requires a matching returned row before success. Bulk UPDATE/DELETE requests returned IDs, verifies the exact selected ID set, and flags partial or zero-row outcomes with a reload. Failure paths avoid false success. No production database permissions or policies were changed.

Regression test `security/build2/crud-rls-mutation-confirmation.test.mjs` verifies source-level contract for all five mutation paths. GitHub Actions run #180: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42689558227 — both jobs succeeded, **129 Node tests, 19 PostgreSQL PASS groups**.

**Important caveats:** these are static code-contract tests and synthetic SQL tests, not a compiled application/browser end-to-end run. Returning IDs requires suitable SELECT privileges/RLS; legitimate writes lacking post-write visibility will be conservatively reported as unconfirmed. PostgreSQL may execute part of a bulk mutation before a partial confirmation; the UI explicitly warns and reloads. Further stage automation consistency, high-volume response limits, and idempotent retries need staging tests. Full schema compatibility, backup/restore, and finance approvals remain blocked.

No merge, deployment, production DDL or business-row reads. All nine release gates remain false.
