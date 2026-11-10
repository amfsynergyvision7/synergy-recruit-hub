# CRM numeric validation — verified 2026-11-10

GitHub Actions run #257: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42694358738

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL integration checks.

Draft `src/components/CrudModule.tsx` now checks numeric form fields with `Number.isFinite(Number(value))` before constructing single-record write payloads. Bulk edits validate numeric input before setting saving state or submitting a mutation. Empty input remains normalized to null according to existing form behavior. Invalid numeric input shows a field-specific error and aborts the write.

Two static regression tests in `security/build2/crud-numeric-validation.test.mjs` assert that both guards occur before their corresponding write paths.

This is client-side validation only; database constraints and server-side authorization remain necessary. No production changes, migration, deployment or merge. All nine release gates remain false.
