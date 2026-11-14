# Build 81 — application security alignment and full source-shaped 38-row + 135-case integration

**13 November 2026 | AMF Synergy Vision | Draft PR #12 | RELEASE HOLD**

## Purpose and boundaries

Build 81 deliberately moved beyond repeated offline plans. It **changed real draft-branch application security code** and successfully executed all 38 invented rows **together with the full 15-surface RLS read design** inside disposable PostgreSQL 17, using the **actual 19-table / 239-column source-shaped lab schema** and **13 source views, 32 disabled application triggers and 75 constraints**. All writes were in a newly created CI PostgreSQL database and rolled back. **It did not** insert anyone into Supabase Auth, apply RLS to hosted nonproduction, perform production/staging database writes, merge `main`, send emails, sync sheets, issue invoices or activate any financial workflow.

### 1. Actual application code fixes

- `src/lib/approved-role-policy.ts`: changed `isApprovedActiveWithRole` to permit exactly **one** matching role row. A duplicate admin row or a conflicting admin + viewer/recruiter + finance assignment now fails closed, matching Build80's `SECURITY DEFINER` RLS helper (`count(*)=1`) rather than allowing any matching role via `.some(...)`. This specifically protects server-side functions that use a privileged service-role client after the guard. Existing single-role admin/recruiter paths remain allowed if their profile is approved and active.
- `src/lib/ai.server.ts`: Gemini HTTP failure, unsupported response, and invalid JSON errors no longer quote raw provider bodies, outputs or prompts, potentially containing candidate resume content. HTTP status remains available in a sanitized message; normal successful structured JSON parsing is unchanged.
- `src/lib/resume-fetch.server.ts`: PDF/Word parser exceptions no longer return the parser's raw exception message to caller; the error is a generic file-format guidance message.
- Added `security/build81/server-unique-role-gate.test.mjs` with 14 role condition cases plus source-contract checks; `candidate-provider-error-redaction.test.mjs` guards the exact error paths in both AI and resume functions.

These are **draft branch code fixes, not deployed production fixes**. Application build/typecheck is included in full guarded CI.

### 2. Real full-source fixture execution in disposable PostgreSQL 17

- `generate-pg17-source-38-fixture.mjs` combines, without copying production records:
  - Build77 **19 source-shaped public CRM tables**, all source enum types, **239 real columns and 75 actual constraints**.
  - Build77 **13 invoker-safe public views**.
  - Build77 **16 source function definitions and 32 disabled application triggers**, with Build78's two source-hardened privileged functions.
  - **Nine invented local Auth-subject IDs**, not a GoTrue Auth service, and Build78's 8 synthetic profiles, 8 role rows, 2 recruiter-owned candidates.
  - Build79's remaining **20 inert records in 16 CRM table groups** (one fictional client; two jobs, submissions, interviews and notifications; inactive/no-op automation, draft zero-billing, email never sent, Sheets disconnected, sync never run).
- Source constraints, CHECK values and all FKs are enforced by the real PostgreSQL engine during insertion. The test proves exact per-table cardinalities, trigger disabled state, row-level security enabled and hardened definitions present.
- `pg17-full-source-135-rls-addon.mjs` then takes the **identical** Build80 15-SELECT-policy review SQL (strips only its own nested transaction boundary, not policy rules), applies it *inside that same disposable transaction*, and replays the 135 frozen Build41 read cases using unprivileged PostgreSQL authenticated-role sessions and synthetic `auth.uid()`. It also verifies zero-subject read denial, four completely denied application tables, six anonymous SELECT denials, recruiter cross-ownership and no direct CRM write grants.
- The combined `security/build81/**` source-test files assert expected DDL/row/case counts, source integrity, no real secrets/production host, one `BEGIN`/`ROLLBACK`, and zero falsely claimed signed UAT.

**ACTUAL passed PostgreSQL job evidence (GitHub Actions):**
```
BUILD81 SOURCE-SHAPED PG17:
  19 tables / 38 invented rows / 75 constraints
  13 invoker views / 32 disabled triggers / 9 fake Auth IDs PASS
BUILD81 FULL SOURCE PG17 RLS:
  135/135 historical reads / 4/4 private denies
  recruiter own-row access / no direct writes PASS
BUILD81 FULL SOURCE PG17:
  6/6 anonymous SQL reads denied
BUILD81_DISPOSABLE_PG17_SOURCE_FIXTURE_ROLLED_BACK
```

The job uses **PostgreSQL 17, actual row-level security, real FK/CHECK enforcement, but invented SQL-role claims**. It is *not* a GoTrue-issued token or signed PostgREST/browser session.

### 3. Actual live state/readiness checks

Dedicated nonproduction `dhlhlasnaapzckjyvffn`: read-only verification found **0** `auth.users`, `profiles`, `user_roles`, `candidates`, installed public app policies, enabled triggers and private review helper schemas. Supabase advisor still reports only intentional 24 informational RLS-enabled/no-policy notices; no mutable search-path warnings.

Production project `wusntntcqgtpgokggdzv` **READ-ONLY**: original **67** public RLS policies, **19** anonymous TRUNCATE-granted tables, **13** public non-invoker views remain unresolved. No production remediation was applied.

GitHub PR #12 is still **DRAFT/unmerged**, with **zero independent PR reviews** and `main` branch `protected=false` from the GitHub branch API. The supplied GitHub connector does not include a branch protection/ruleset creation operation, so no independent security governance is falsely claimed.

### 4. What is and is not completed

**Engineering:** 38-row full source-shaped fixture actually runs in disposable PostgreSQL; the **same 15 proposed RLS policies yield 135/135 historical SQL read counts** in that full source-shaped database. Security gate alignment and candidate error redaction changed the application code. GitHub CI validates source, integration and application compile in draft PR only.

**Not accomplished:** 0/9 real hosted GoTrue UAT identities, 0/38 hosted synthetic fixture rows, 0/140 formally signed hosted UAT cases, 0/48 accepted production security remediations, 0/9 signed release gates, 0/6 formally closed AI Command Center workstreams. The five historical DML UAT cases, browser/view permission tests, restore/PITR, branch protection, independent reviewers and privacy/HR/legal/finance gates remain independent prerequisites for production release.

Build78's guarded server-only Auth Admin provisioner needs an **authorized service-role credential for the dedicated nonproduction project supplied via a private secret manager**. The connected Supabase tool does not expose an Auth Admin `createUser` operation or that secret. Do not copy production credentials or inject secrets into ChatGPT, GitHub source/comments or issue discussions. Do not insert directly into `auth.users`. After a supported Auth Admin execution, the 8/8/2 and 16-table seed stages, independent RLS review and 135 real hosted signed read cases can be run. Avoid financial, external email and workflow activation until their own release gates.

**Planning forecast: 5–10+ further substantive CRM iterations to a separately approved `main` merge; 15–30+ for the whole six-workstream system.** Conditional on secure nonprod Auth Admin execution and human reviewers/signatories. No finite build count is guaranteed while these dependencies remain unresolved.

**Evidence:** draft PR #12, issue #13 (hosted UAT), issue #14 (governance). Full GitHub CI and fast CI runs are linked from the PR's checks; the intentionally failing production-release-hold remains in effect. This document is source/evidence documentation, not an independent release acceptance.
