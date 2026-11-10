# Phase 1 Business Development — Synthetic Prototype
Branch: feature/bd-phase1-synthetic-20261109 (based on main)
Status: code committed for review; not deployed or connected to live CRM.

## What is implemented
- /bd page, linked from existing sidebar as "Business Development · Demo"; route content is restricted to the existing admin role as a temporary prototype guard (not a substitute for RLS)
- KPI dashboard (organizations, contacts, open/won opportunities, pending/overdue tasks)
- Organizations directory with in-session add and case-insensitive duplicate warning
- Contacts directory with organization linkage and basic email validation
- Opportunities list with three types: recruitment services, partnerships and CRM software
- Filterable seven-stage pipeline, manual stage change
- Follow-up tasks with due dates and completion toggle
- Reset synthetic data
- Synthetic-only model and twenty-one authored regression tests

## Privacy and runtime
No Supabase import in BD route or model. No network, email sending, real candidate/customer data, browser persistence, localStorage or service role. All entries exist in React state and reset on reload. Do not enter real personal or confidential information.
This is not production access control; it uses the existing app shell and is NOT a secure multi-tenant release.

## Run locally (requires existing project dependencies)
npm install
npm run dev
Open /bd in authenticated development app.
npm run test:bd
npm run build
npm run lint

## Known limitations
The new tests are authored but not yet run against the actual GitHub branch in an installed checkout in this execution environment. No build or browser QA evidence yet. Full integration, persistence, RBAC, RLS, outreach approvals, stage history, import/export, server validation, responsive QA and accessibility audits remain. Existing production security issues are not remediated by this prototype. There is no production deployment or Supabase SQL.

## Review criteria
- All three opportunity types visible
- Organization/contact association correct
- Pipeline stage change reflects in cards
- Task completion changes pending count
- Reset restores synthetic fixtures
- No external sends or live data reads

## November 9 continuation
- Added npm run test:bd to package scripts.
- Added admin-only prototype gate while BD authorization is not implemented; the sidebar link itself remains visible, and the page explains restricted access to non-admins.
- GitHub clone is blocked in the current local container because github.com DNS resolution is unavailable; repository test/build execution is still unverified. No CI run was triggered and no production deployment occurred.

## Additional controlled fixes — 2026-11-09
- Added case-insensitive duplicate work-email check for synthetic contacts (17 authored tests total).
- Reject toggling nonexistent follow-up task IDs instead of reporting success.
- Moved prototype navigation entry into existing Admin menu, matching route-level admin gate.
- Added tests for duplicate email, missing task and valid task creation.
- Full npm test/build/lint/browser verification still pending; no production changes.

## Explicit demo feature flag (2026-11-09)
The /bd route now requires VITE_ENABLE_BD_DEMO=true and admin role. Sidebar entry is hidden unless the same flag is enabled; this prevents accidental demonstration exposure if a later merge occurs. In a local development shell, set VITE_ENABLE_BD_DEMO=true before npm run dev. This is a UI safety switch, not production-grade authorization or a substitute for RLS. No flag was set in production. Eight source-readback static checks passed, including flag/role guards, no Supabase imports in the BD route/model, 17 authored test declarations and test script presence. Full npm build, lint, tests and browser verification remain pending.

## Form and calendar hardening — 2026-11-09
- Validation failures now preserve all four form inputs; mutate reports success/failure and clears inputs only on success.
- Today's date for task creation and overdue KPI uses local calendar components rather than UTC ISO date to prevent off-by-one dates in non-UTC time zones.
- Seven source-readback checks passed for these changes. This is not equivalent to running build/tests/browser checks.

## Record identity hardening — 2026-11-09
- Reject blank or duplicate synthetic IDs for organizations, contacts, opportunities and tasks.
- Added four collision tests; total authored model tests: 21.
- Source readback verified all four guards and test declaration count. Full test suite, lint, build and browser review still not executed.
