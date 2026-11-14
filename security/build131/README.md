# Build 131 — Count-complete CRM grid, relation and board paging

**Status:** Draft-only work on [PR #12](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12). No protected-main change, staging or production database mutation, hosted Auth provisioning, Vercel production release, external email, candidate-finance activation or independent sign-off.

## Starting evidence

Build130 final head `8e07cda5f709e67c600ad91416917f7e4e9c4ef0` passed **610/610 fast tests**. Its guarded workflow had **36 successful substantive jobs and one deliberately failed `production-release-hold`**. Fixed 43-gate acceptance was 26/100, 12/43 milestones evidenced, 31 open.

## Implemented engineering changes

1. Created `src/lib/bounded-crm-read.ts`, reusing the previously tested `readBoundedReportRows` transport contract. Every list reads **250 records per ID-ordered page, with an absolute 2,500-record maximum** and an exact count on every page. It rejects count drift, duplicated/out-of-order IDs, incomplete server pages, timeouts/aborts and over-limit totals; no partial result is returned.
2. `src/components/CrudModule.tsx`: replaced the prior one-shot 250-row query with the count-complete ID-page snapshot. Sort complete records locally on its configured order column, with stable ID tie-breaking, preserving the usual newest-first display. Calls remain account/role keyed and cancellable, with no unscoped realtime.
3. Every relation-selector source uses the same count-verified 2500-record paging, rather than returning only 250 options. If a relation source is incomplete or unavailable, its choices are cleared and **Add/Edit/Delete and CSV export are withheld**; the record source must also have completed before actions become available.
4. `src/components/CandidateBoard.tsx`: uses count-reconciled pages and the same absolute cap, still projects only `id, candidate_code, full_name, position_applied, assigned_recruiter, stage`. Unknown stages invalidate the entire snapshot; stage drag/drop can only be enabled after a verified complete read, and the unconditional candidate mutation release hold remains active.
5. Reconciled old source-shape tests in Builds126–128 with stronger shared ID pagination, without suppressing any security invariant. Added direct pagination and adversarial tests at `security/build131/bounded-crud-pagination.test.mjs` and `bounded-candidate-board.test.mjs`, plus an immutable Build130 score baseline and Build131 acceptance regression.
6. Both fast and guarded workflows execute the new suites and retain the explicit production release-hold job.

## Non-negotiable privacy limitations

This is **browser-side correctness, not hosted role authorization**. Generic CRM grid records still use `select("*")` for legacy editing; the field projection and row-grant/RLS security audit are **not accepted**. Increasing the count limit therefore does not make it safe to deploy this branch. Actual server RLS/column permissions, recruiter scope, consent, and signed UAT must be independently reviewed before production use. Candidate board's reduced column projection is retained.

Large datasets above 2,500 rows still fail closed rather than silently exporting partial datasets. Server-side filtered queries and role-safe aggregations are a separate performance/design milestone, not claimed complete here.

## Current release gates and concrete next owner actions

| Critical gate | Current evidence | Required next action |
|---|---|---|
| REL01 protected main | `protected=false`, rulesets `[]` | Repo admin: Settings → Branches or Rules → Rulesets → target `main`; require PR, approved independent review, required substantive CI, resolved discussions; disable force pushes/deletions/bypass; read back |
| REL02 protected independent Auth PR | [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) open, 0 submitted reviews | Authorized independent reviewer evaluates exact SHA, then repo admin verifies protected merge; do **not** merge it without review |
| Dedicated nonprod Auth environment | No independently verified protected GitHub Environment or lab keys | Repo admin sets environment `amf-nonprod-auth-review` with independent required reviewer, prevent self-review, protected branches only, nonproduction-only two secrets; never production secret |
| CRM06/07 synthetic fixture | Isolated lab: 0 users / 0 of 38 rows | Only after the above gates, guarded manual `AUDIT_ONLY` then exact nine fictional example.invalid Auth users and 38 inert records with readback |
| CRM08 hosted acceptance | 0/140 signed cases | Complete 135 signed reads + five controlled signed writes; independent reviewer accepts evidence |
| CRM09 permissions | 0/48 remediations accepted | Independently review, test, and accept 19 table grants, 13 views, 16 privileged functions |
| REL03–REL07 and CRM05/10 | Outstanding release, review and operating approvals | Sign off backups/PITR, privacy/legal/HR/finance, monitored rollback, entire PR #12, and nine formal release approvals |

The present GitHub integration exposes neither branch-protection mutation nor protected environment-secret configuration; an independent human reviewer cannot be impersonated by the code author. Do not count a general management authorization as signed independent evidence.

## Fresh nonproduction read-only observation

Dedicated Supabase project `dhlhlasnaapzckjyvffn` is `ACTIVE_HEALTHY`, with **19 public RLS-enabled tables**, **0 Auth users**, **0 public RLS policies**, **0 public enabled application triggers**, and **0 table rows reported**. No DB writes or account creations performed.

## Programme and evidence

Fixed acceptance is **26/100 weighted points, 12/43 milestones evidenced, 31 open**. The 43-gate scoring system is binary; browser refactors do not close production/security/BI milestones without signed evidence.

CI must be evaluated at the exact final Build131 branch SHA, not an intermediate test. The guarded workflow's deliberate release-hold failure must remain explicit even when substantive jobs pass. Vercel preview status on another commit does not establish a READY final-head release.

**Recommended next build focus:** finish all independently controllable GitHub protection/review and isolated Auth test setup first, rather than starting more speculative pre-release feature builds. Once the actual hosted setup is usable, begin the missing signed 140-case UAT matrix.
