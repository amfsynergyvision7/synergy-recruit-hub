# Build 2 release gate evidence reconciliation — 2026-11-10

This document distinguishes **verified offline evidence** from **production release acceptance**. It does not change `release-evidence.json`, which deliberately has all nine flags false.

| Release gate | Available evidence | Missing for release |
|---|---|---|
| isolated_postgresql_rls_tests_passed | CI #106, 12 disposable PostgreSQL groups, offline tests | Full production-shaped schema/roles and application paths; independent review |
| all_19_tables_reviewed | Metadata inventory and 19-table grant proposal tested against stubs | Actual policy matrix and role compatibility for all 19; stage history policy |
| all_13_views_hardened_and_tested | All 13 definitions inspected; grant/options draft compiled; 3 projection-shaped and aggregate tests | Actual view SQL and base grants in staging, recruiter report inactive semantics |
| all_16_definer_functions_reviewed | Catalog inventory; selected helper, resolver, reminder and workflow body triage | Every body, trigger context, role, caller, scheduler and grants tested |
| admin_approval_and_role_workflows_tested | Negative synthetic tests | Approved admin-only mutation endpoints and UI workflow tests |
| recruiter_ownership_and_column_grants_tested | Synthetic A/B RLS and column-grant checks | Live-shaped role/field tests and immutability enforcement |
| notifications_and_email_log_permissions_tested | Draft email-log policies and synthetic grants | Legitimate write paths, scheduler and email-log UI/API regression |
| rollback_rehearsed | CI #98/#106 disposable transactional savepoint reversal | Exact migration reverse script, backup restore, availability and dependency test |
| release_approved | No release approval | Explicit separately recorded authorization after all technical gates |

Latest verified CI: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42684794707 — two jobs successful, 12 PostgreSQL PASS groups.

GitHub compare `main...security/build2-rls-ai-design-20261109` at time of review: **diverged, 97 ahead, 27 behind**, 62 changed files reported. Recheck immediately before reconciliation. Do not merge into `main` until release dependencies are assessed.

## Immediate technical priorities (no new user intervention for draft-only work)

1. Review real CRM UI and API calls for admin approval, role management, candidate ownership, notifications and recruiter reports; document a deny-by-default compatibility matrix.
2. Create a complete synthetic production-column-shaped PostgreSQL schema, including trigger functions and dependencies, and compile exact reviewed migration/reverse migration there.
3. Validate `run_workflow_rules()` against a trusted table/column allowlist and restrict who can create/update workflow rules. Current isolated allowlist fixture is **not wired into the production function**.
4. Confirm actual scheduled-job principal and function EXECUTE grants; restrict arbitrary-ID resolver calls without breaking legitimate CRM paths.
5. Reconcile the 27 missing `main` commits only after reviewing their effects; remain on the dedicated unmerged draft branch.

**Production untouched; no business rows read; no deploy, merge or release approval.**
