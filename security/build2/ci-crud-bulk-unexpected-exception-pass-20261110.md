# CRM unexpected bulk-operation exception recovery — verified 2026-11-10

GitHub Actions run #314: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42698023830

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` now catches unexpected exceptions escaping the bulk batch helper for both bulk delete and bulk edit. The handlers report the mutation outcome as unknown rather than claiming the database rejected it; they retain the existing refresh-and-inspect error path and release the shared concurrency guard and loading indicators in `finally`.

Static regression coverage: `security/build2/crud-bulk-unexpected-exception-recovery.test.mjs`.

**Caveat:** when an unexpected exception escapes the helper, the fallback does not know which earlier batches committed and therefore cannot report a precise confirmed count; the message directs operator review. Server-side idempotency and transactional guarantees remain separate concerns. No staging or production changes, merge, deployment or external communications. PR #11 remains unmerged; all nine release gates false.
