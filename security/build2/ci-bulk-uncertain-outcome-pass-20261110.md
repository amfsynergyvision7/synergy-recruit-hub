# Bulk mutation uncertain outcomes — verified 2026-11-10

GitHub Actions run #251: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42694024533

All three jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

The draft shared CRUD component now distinguishes an unconfirmed batch from a confirmed failure on three paths: (1) an error response from Supabase, (2) an incomplete returned-ID set, and (3) a thrown network exception. Operator messages require refreshed-record inspection before retrying. Static regression assertions cover all three warning paths.

**Remaining limitation:** returned-ID confirmation is not an exactly-once guarantee. Prior batches may have committed and a lost response can conceal a committed batch. No automatic replay, migration, production write or policy activation occurred. A future authorized staging/browser test must simulate commit-then-lost-response and verify reconciliation without duplicate side effects.

PR #11 remains unmerged; nine production release gates remain false.
