# Transactional rollback rehearsal — verified 2026-11-10

GitHub Actions run #98: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42684534515

Tested commit: `0724ccc9b25fffd880b98f834e3740185bfd9acf`. Both CI jobs succeeded; PostgreSQL logs show **11 PASS groups**, including:

`PASS: disposable transactional rollback restores original policy, anon grants and view security options`

The disposable test creates an intentionally permissive policy, anonymous table/view grants and a default-security view. It simulates DROP/CREATE POLICY, REVOKE and `ALTER VIEW ... security_invoker=true` in a transaction, rolls back to a savepoint, then asserts restoration of the original policy, privileges and view settings.

**Strict limitation:** this is a transactional rollback rehearsal, not an approved production reverse migration or physical backup/restore test. It does not rehearse data conversion, concurrent clients, trigger/scheduler dependencies, actual 19-table/13-view schema restoration or application availability. Production unchanged; no CRM row access, deployment or merge. All nine production release gates remain blocked.

Before production release: obtain verified metadata-only pre-change snapshots; design and review reverse migration for actual objects; rehearse against complete synthetic schema; verify backup recovery point and restore process; perform full application compatibility tests; obtain explicit production authorization.
