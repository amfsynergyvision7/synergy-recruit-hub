# Phase 1 Business Development — Synthetic Prototype
Branch: feature/bd-phase1-synthetic-20261109 (based on main)
Status: code committed for review; not deployed or connected to live CRM.

## What is implemented
- /bd page, linked from existing sidebar as "Business Development · Demo"
- KPI dashboard (organizations, contacts, open/won opportunities, pending/overdue tasks)
- Organizations directory with in-session add and case-insensitive duplicate warning
- Contacts directory with organization linkage and basic email validation
- Opportunities list with three types: recruitment services, partnerships and CRM software
- Filterable seven-stage pipeline, manual stage change
- Follow-up tasks with due dates and completion toggle
- Reset synthetic data
- Synthetic-only model and twelve authored regression tests

## Privacy and runtime
No Supabase import in BD route or model. No network, email sending, real candidate/customer data, browser persistence, localStorage or service role. All entries exist in React state and reset on reload. Do not enter real personal or confidential information.
This is not production access control; it uses the existing app shell and is NOT a secure multi-tenant release.

## Run locally (requires existing project dependencies)
npm install
npm run dev
Open /bd in authenticated development app.
node --test tests/bd-demo-model.test.mjs
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
