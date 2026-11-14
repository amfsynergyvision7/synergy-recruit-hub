# Build 132 — Repair actual guarded-CI failures and enforce early compiled feedback

**Status:** Draft-only PR #12. No merge to `main`, staging/production data mutation, hosted Auth identity setup, financial workflow activation, recruitment emails, external publication or independent release sign-off.

## 1. Actual Build131 final-head result, corrected

Build131 final SHA `7d6eddb8ae8f6f122091811994bc26b5519fa684` did **not** satisfy its own exact-head compile contract. GitHub Actions fast workflow `43579565277` passed **654/654 offline tests**; however, guarded workflow `43579565265` completed with **33 successes in 37 jobs**, plus four failures:

1. `application-compile`: TypeScript did not accept dynamically typed PostgREST page builders as `PromiseLike<ReportPage<{id:string}>>`.
2. `build50-browser-write-safety`: a brittle historical expression assertion no longer matched the candidate delete hold after the stronger complete-data gate was introduced.
3. `substantive-security-summary`: downstream failure because the above two nonrelease jobs did not pass.
4. `production-release-hold`: intentional expected red; **must remain red**.

Prior Build131 response had counted the fast tests accurately but could not claim guarded pass. This build corrects the defect, not a false new acceptance milestone.

## 2. Implemented repairs and hardening

- **Runtime typed API boundary:** `src/lib/bounded-crm-read.ts` now exports `checkedCrmPageIds` to inspect unknown PostgREST rows. It rejects missing/nonarray data, malformed/null/numeric/empty IDs and misleading id types, before returning a typed array. The count-complete reader still rejects duplicate/out-of-order IDs, count drift and page truncation.
- **Awaited Supabase response:** `CrudModule` awaits the actual page request for both main and relation selector queries and narrows the result only after runtime checks. This eliminates the prior invalid inferred `PostgrestFilterBuilder` type assumptions.
- **Unconditional hold compatibility:** Browser mutator eligibility keeps `!candidateMutationPaused && !billingMutationPaused` alongside `verifiedForMutation`. Every four mutation callbacks (`save`, `remove`, `bulkDelete`, `applyBulkEdit`) independently checks effective permission and complete-page state *after* the candidate/billing hard holds, preventing stale UI actions from bypassing the verified-read gate. Joined-offer finance holds remain.
- **Early independent write-hold checks:** Added a separate fast no-secret job running the original Build50 candidate/CRUD hold and Build56 financial/joined hold suites. These previously failed late inside the guarded workflow without any fast warning.
- **Early real compile:** `.github/workflows/security-build65-fast.yml` now includes a no-secret `application-typecheck-fast` job that runs a locked install, `npm run build` to generate TanStack routes, then `npx tsc --noEmit`. Prior fast feedback tested only JS contracts and missed a TypeScript failure; standalone `tsc` on a clean checkout falsely failed on ungenerated routeTree, hence the explicit build step.
- **Regression:** `security/build132/typed-crud-compile-and-write-guards.test.mjs` exercises runtime malformed ID rejection, mutation guards, and CI sequencing; `scorecard-progression.test.mjs` prevents accepting a milestone without independent evidence. Historical Build131 score snapshot and prior Build128/131 source-format tests are pinned/reconciled without disabling safety requirements.
- **No RLS expansion:** the generic CRM record projection still contains `select("*")` and its privacy/permission scope requires external review. This build does **not** claim production privacy completeness.

## 3. Formal score and release blockers

The fixed 43-gate ledger remains **26/100**, **12 evidenced** and **31 open**, with **74 points outstanding**. Source-only fixes do not grant formal signoffs. Build131's CRM02 exact-head proof was defective; that technical gate should not be treated as independently restored until **the final Build132 SHA** passes the guarded compile/typecheck and all other substantive jobs. The overall numeric ledger is a historical progress record, not an assertion that a failing head was release-ready.

Read-only isolated Supabase lab `dhlhlasnaapzckjyvffn`: `ACTIVE_HEALTHY`, 19 public tables / 19 RLS enabled, zero public policies, zero Auth users, no enabled public application triggers, and zero rows observed. No SQL writes or external effect activation.

`main` remains at `c735292fbace6605d691a68b602a02b2c6f9e137`, **unprotected**, with zero rulesets. PR #12 is draft, PR #15 open, both unmerged and with zero submitted independent reviews. Hosted Auth 0/9, fixture 0/38, signed hosted UAT 0/140, accepted production remediation 0/48 and release signoffs 0/9. Final-head Vercel READY is not verified; its build-rate-limit failure is not a passing deployment.

## 4. Exactly what the owners need to do to enable a real merge

1. **Repository administrator** must enable substantive protected-main PR rules: required verified CI, independent approvals, resolved conversations, no force pushes or bypass. Current GitHub integration does not expose a branch-protection mutation action; prior protection GET returned an authorization error.
2. **Independent security reviewer** must formally review exact-SHA nonprod Auth [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) and sign an independently controlled protected lab environment `amf-nonprod-auth-review`. Do not use author's approval as an independent review.
3. **Lab operator** must configure isolated lab-only secrets in that environment and run the already prepared manual `AUDIT_ONLY` readback, then independently approved 9 synthetic example.invalid Auth users and 38 inert hosted rows. Do not copy production secrets or create live customer data.
4. **UAT/security/operations owners** must independently accept 140 signed hosted cases, 48 production remediations, backups/restore and permitted finance scope, and nine release signatures before the protected merge and production deploy.

The current technical repair must be verified on its final SHA; a green intermediate fast run is not sufficient. Deliberate `production-release-hold` must remain red.
