# Bulk network-failure recovery and selection reconciliation — verified 2026-11-10

GitHub Actions run #235: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42693056360

All three CI jobs passed: application build/TypeScript, **132 Node tests**, **21 isolated PostgreSQL PASS groups**.

Draft `src/components/CrudModule.tsx` now catches rejected/thrown batch mutation requests and returns a reported error rather than leaving the operation in a permanently loading state. After a partially confirmed UPDATE or DELETE, the selection set is reduced to IDs not confirmed by the server; the list is refreshed and an error reports the confirmed count. Static source-contract test `crud-rls-mutation-confirmation.test.mjs` now asserts the catch path and unconfirmed-only selection behavior.

**Limits:** an HTTP/network failure after a server commit may leave an unconfirmed outcome; not returning an ID does not prove the write failed. An operator must inspect the refreshed list before retrying. The retained selection is a UI convenience, not an instruction to blindly retry. Multi-batch operations are non-atomic. Live role-based E2E and staging migration/rollback gates remain blocked.

No production changes, merge, deployment, business-row reads or external communications. All nine release gates remain false.
