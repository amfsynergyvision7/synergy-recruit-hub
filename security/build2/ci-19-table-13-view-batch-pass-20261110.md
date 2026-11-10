# Consolidated 19-table and 13-view SQL batch — verified 2026-11-10

GitHub Actions run #72: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42683385130

Tested commit: `272b74b4e9302028dcd1ed1d1f004dfaea30c871`.

**Both CI jobs passed.** Seven PostgreSQL PASS messages were verified, including the new:

`PASS: actual 19-table/13-view grant SQL and 3-table policy SQL pass disposable metadata checks`

The batch executed the **actual review-only** `19-table-13-view-grants-review-only.sql` and `additional-three-tables-review-only.sql` against disposable PostgreSQL objects, after the 15-table proposal fixture. It checked that anon has no effective SELECT on all 19 tables and 13 views, that all 13 views have `security_invoker=true`, and that five additional policy definitions exist.

**Important limitation:** the 13 view definitions in this fixture are deliberately simplified projections, and the 19 tables are synthetic stubs. It is a SQL compilation/privilege metadata test, not a reproduction of actual view dependencies, user interfaces, financial permissions or all production grants. The 19th table `candidate_stage_history` has only anonymous grant restriction in this draft, not a complete replacement RLS policy. The additional three-table draft may leave other existing policies intact; check OR-composition before any release.

Production unchanged, no CRM rows read, no PR merge or deploy. All nine release gates remain blocked.
