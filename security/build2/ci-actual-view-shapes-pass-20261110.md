# Actual view-definition-shaped regression batch — 2026-11-10

Read-only `pg_get_viewdef` metadata verified three actual production view projections: `vw_candidate_filters`, `vw_billing_filters` and `available_recruiters`. The first two are direct candidate and billing projections. `available_recruiters` selects approved profiles but **does not explicitly filter `is_active=true`**; it also labels them `Available`. This is a live-definition design discrepancy, not proof that production currently exposes inactive users.

The disposable PostgreSQL test reproduces their observed projections using reduced, synthetic column-compatible tables, `security_invoker=true` and explicit RLS. It verifies candidate recruiter isolation, billing denial and inactive-profile exclusion under the **proposed synthetic profile RLS**. The live view itself is unchanged.

GitHub Actions run #78: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42683711324

Tested commit: `be653c9e1e67203dd213c457a6d5d5a3dd6bccc8`. **Both jobs succeeded**; PostgreSQL logs contain eight PASS messages, including `PASS: three actual-definition-shaped invoker views enforce synthetic recruiter, finance and active-profile RLS`.

**Release blockers remain:** verify and redesign production `available_recruiters` semantics and actual RLS, complete all 13 view dependencies, all 19 table policy/grant matrices, 16 privileged functions, app compatibility, migration and rollback rehearsal. All nine release gates remain blocked. No production changes or CRM row access.
