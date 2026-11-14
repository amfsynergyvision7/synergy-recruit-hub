# Build 123 — reporting data minimization, finance release hold and CSV injection protection

## Original app exposure found

- Reports fetched the entire accessible candidate/submission/interview/offer/client/profile datasets and a separate billing table, including CTC, salary, invoice and payment values, from a page visible to all approved CRM roles.
- Dashboard independently fetched raw billing amounts and displayed Revenue / Pending Payments KPIs, despite the inactive and independently unapproved finance policy.
- Audit Logs route fetched `select('*')` and displayed user emails without a direct administrator-only permission check; sidebar showed Audit Logs to every role.
- Shared `rowsToCsv` quoted CSV separators but permitted spreadsheet formula cells starting with =, +, - or @ (including zero-width/whitespace prefix). Exports across the CRM could expose a recipient to CSV formula execution.

## Actual application fixes

1. Shared pure client `crm-report-access.ts` checks exact approved Supabase identity, verified role and a compile-time true financial release hold. Reporting limited to admin, recruiter and operations; Audit metadata limited to admin; financial analytics held for every role. Browser checks supplement, not replace, backend RLS.
2. Reports query is keyed by Auth subject and role, disabled for unauthorized accounts, minimizes fields and surfaces a generic failure on any Supabase error. No billing table, salary/CTC fields, financial CSV export or billing report.
3. Dashboard validates same reporting role before any fetch, resets local state when role or account changes, ignores in-flight stale results, and removes financial amount query and KPI cards. Realtime channel is scoped to current subject label and unsubscribed on deactivation; **its event subscription is still not a PostgreSQL row-level filter**, so RLS and server authorization remain mandatory.
4. Audit route checks administrator access before SQL, selects only action metadata (no `*\`, user_email, before/after payload), ignores results after account changes and shows generic failure without raw backend details. Sidebar suppresses unauthorized items.
5. Direct billing route does not mount its CRUD module while financial analytics are held; none of its financial records or sensitive relation selectors are fetched from this view.
6. CSV export prefixes user-originated formula-like text with an apostrophe, including formulas concealed behind whitespace/invisible characters; genuine negative numeric cells retain numeric representation. This is app-layer mitigation and does not substitute for export access policy.

## Validation

Pure and source regression suite `node --test security/build123/report-access-and-csv.test.mjs`, included in fast CI. Guarded workflow triggers on all touched routes/helpers. TypeScript/build validated in exact-head guarded workflow if successful; intentional release hold remains red.

## Uncredited acceptance and release dependencies

Build123 does not close BI01 approved KPI dictionary, BI02 accepted role-safe server/RLS reporting model, BI03 signed dashboard acceptance, BI04 monitored reconciliation or BI05 owner signoff. It is a draft application-security remediation only. Existing 48 production permission objects and 140 hosted signed UAT cases are not accepted from browser tests, and no production/staging DB writes, merge or deployment are authorized.


## Fixed deployment score — nonclosure

All Build123 changes are engineering security work, not a new signed milestone. The v1 programme score remains **26/100** and release-governance **0/20**. The BI02 acceptance demands independently accepted role-safe backend/RLS aggregate contracts; this build supplies client defense-in-depth only. The signed 140 hosted UAT, 48 production remediations, nine formal release approvals and independent GitHub reviewer have not advanced. A successful test suite is not a production authorization.
