# Unknown-commit warning and candidate-route CI coverage — 2026-11-10

GitHub Actions run #245: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42693730123

All three CI jobs succeeded: application build and TypeScript, offline security tests, and isolated PostgreSQL integration checks.

Draft change in `src/components/CrudModule.tsx`: when a bulk mutation request throws, its message now explicitly identifies the batch outcome as **unknown** because the server may have committed despite a lost response. It directs the operator to inspect refreshed records before retrying. Regression `security/build2/crud-rls-mutation-confirmation.test.mjs` checks this warning. This does not provide exactly-once execution or transactional rollback; reconciliation is still manual.

CI change in `.github/workflows/security-build2-offline.yml`: `src/routes/_app.candidates.tsx` is now included in both push and pull-request path filters, ensuring candidate assignment route changes run security checks.

These are draft-only improvements. No staging role-based browser test or complete-schema migration/rollback was performed. All nine release gates remain false, PR #11 remains unmerged, and production remediation remains undeployed.
