# CRM list refresh exception recovery — verified 2026-11-10

GitHub Actions run #271: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42695415299

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` now wraps list refresh in try/catch/finally. A rejected network request displays a refresh failure notification and always clears the loading indicator. Supabase error responses also display a refresh error. Previous rows are preserved on failure, rather than overwritten with an empty array. New static regression coverage is `security/build2/crud-refresh-failure-recovery.test.mjs`.

**Limits:** this fix does not guarantee freshness of retained rows after a failed refresh. Operators must confirm the server state before retrying an unconfirmed mutation. Concurrent request ordering and stale selection after a successful refresh remain separate review topics. No production changes, merge, deployment or release gate clearance. All nine release gates remain false.
