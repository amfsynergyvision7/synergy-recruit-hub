# Workflow UI / SQL allowlist compatibility contract — verified 2026-11-10

Source: `src/routes/_app.workflow-rules.tsx`; provisional SQL: `security/build2/synthetic-workflow-field-allowlist.integration.sql`.

Automated test `workflow-ui-allowlist-contract.test.mjs` inventories six UI tables and their field options, then asserts which fields are present in the SQL allowlist. It deliberately treats `offers.joining_status`, `billing.payment_status`, `clients.status` as **unapproved/missing**. This is a compatibility alarm, not authorization to enable them.

First CI run #168 failed because the test accidentally matched a forbidden-pair example later in the SQL fixture as though it were a permitted pair. Corrected by restricting parsing to the SQL function definition. Follow-up run #170: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42688867566 passed **126 Node tests, 19 PostgreSQL PASS groups, both jobs**. All nine release gates remained blocked.

The test is a pinned source inventory; it will intentionally fail if the UI adds/removes fields or if the provisional SQL predicate changes without updating this review. It does not run the application or confirm real workflow rules in production. Finance and workflow-owner approvals remain required before extending the database allowlist.

No production changes or business-row access. PR unmerged.
