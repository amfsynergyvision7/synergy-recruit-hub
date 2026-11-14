# Build 124 — Fail-closed completeness for reporting and dashboards

## The concrete defect

The existing Reports page and Dashboard used a single Supabase SELECT response to compute stage, recruiter, joining, source, and client reports. Data API SELECT calls may be capped (often at 1,000 rows), so the UI could silently show plausible but incomplete KPIs. Dashboard also permitted overlapping interval/realtime refreshes to overwrite newer data and ignored some source count errors. The prior reports page queried the whole profiles directory despite needing only recruiter attribution.

## Code changes

1. `src/lib/bounded-report-read.ts` implements read-only, explicitly bounded page reads (250 records per request; 2,500 per dataset), with exact row-count reconciliation on every page, unique ascending ID ordering, duplicate/overlap detection, error-data redaction and AbortSignal checks. If the row count is over the safety cap, data shifts, API trims pages or any query fails, the report refuses to calculate rather than exporting incomplete rows.
2. `src/routes/_app.reports.tsx` uses the helper on all five tables actually needed, with `count:'exact'`, explicit `.order('id')`, `.range` and `.abortSignal`, using React Query's cancellation signal. Removed the unnecessary global profile list: recruiter attribution is displayed as a short ID rather than copying unrelated employee full names. Financial values remain absent and unapproved.
3. `src/routes/_app.dashboard.tsx` uses the helper for candidate-stage and joined-offer datasets and requires all eight count-only API calls to succeed with nonnegative integers. Refreshes are assigned monotonically increasing sequence numbers, abort the prior controller and ignore late results after account/role change. On a current-request failure, all partial metrics are cleared and a generic verification error is displayed.
4. Dashboard recruiter profile metadata is fetched only for the assigned recruiter IDs derived from authorized candidate rows, with a 100-ID cap and signal cancellation. This is defense-in-depth, NOT an override of Postgres RLS.
5. Node suites cover exact edge conditions (0, 250, 1001, 2500 and 2501 rows), server truncation, drifting counts, duplicate/unsorted keys, cancellation, backend errors, route wiring, safe report exports and dashboard refresh protection.

## Scope limitations and acceptance

- The cap is intentional. A dataset above 2,500 visible records must be handled by an independently reviewed server-side aggregate model (BI02); do not weaken caps to conceal incomplete reports.
- Exact counts and stable offset order reduce silent truncation but do not create a cross-request PostgreSQL snapshot. Concurrent inserts/deletes can change page counts and trigger retry; full transactional reporting remains part of BI02/BI04.
- This source change does not create or approve a CEO KPI dictionary, server/RLS data contract, fully accepted BI dashboard, hosted signed UAT, production remediation, protected branch or any financial workflow. Fixed v1 remains at 26/100 until independently verified acceptance gates close.
- Run `node --test security/build124/report-completeness.test.mjs security/build124/report-ui-binding.test.mjs`. Exact-head fast and guarded GitHub workflows are required before reporting a compiled build.

References: Supabase JavaScript range documentation https://supabase.com/docs/reference/javascript/using-modifiers-range ; draft PR12 release register, not an authorization to deploy.
