# CRM refresh ordering and selected-row reconciliation — verified 2026-11-10

GitHub Actions run #284: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42696060987

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` now uses a monotonically increasing refresh sequence reference. Only the most recent request may update rows, show refresh errors, or clear the loading state; component table-subscription cleanup invalidates pending requests. On successful refresh, selected IDs are intersected with IDs in the newly returned rows. This prevents stale selections from persisting after successful row disappearance. On refresh failure, previously loaded rows and selections are retained for operator inspection.

Static regression tests: `security/build2/crud-refresh-ordering-and-selection.test.mjs`; updated `security/build2/crud-refresh-failure-recovery.test.mjs`. Earlier CI runs exposed an outdated assertion and a TypeScript dynamic-table inference issue; both were corrected and the final run passed.

**Remaining caveats:** client-side sequence checks do not provide database transaction ordering or exactly-once bulk mutation semantics. Browser tests must validate live realtime events, partial failures, and paginated lists. Staging migration/rollback and role-specific authorization checks remain unperformed. All nine release gates remain false. PR #11 remains unmerged; production unchanged.
