# Build 130 — Recruitment KPI integrity and exact lab readiness evidence

**Source branch:** draft PR #12. No merge, deployment, hosted Auth account creation, database write, RLS installation, financial activation, external communication or reviewer self-signoff.

## Baseline verified before work

- Build129 final-head fast CI: **581/581 PASS**. Guarded CI: **36/37 jobs success**; the sole failure was the deliberately enforced `production-release-hold`.
- `main` remains unprotected and unchanged at `c735292fbace6605d691a68b602a02b2c6f9e137`; zero repository rulesets; PR #12 draft, PR #15 open, both unmerged with zero independent submitted reviews.
- Fixed acceptance rubric: **26/100**, **12 of 43** evidenced, 31 open and 74 weighted points remain. Protected merge readiness 0/8.

## Actual engineering change

1. **Recruitment reports:** new pure `src/lib/report-source-integrity.ts` checks that all candidate stages are recognized; each submission/interview/offer references a visible, existing candidate and client; and conflicting legacy vs UUID aliases are rejected rather than arbitrarily selected. A missing link is a generic report error, not a plausible partial recruiter/client KPI.
2. **Unassigned activity:** the recruiter performance table includes a distinct `Unassigned` category instead of dropping rows and events whose candidates lack an assigned recruiter. A valid empty dataset remains an empty report.
3. **Date-window correctness:** local calendar dates replace UTC rollover in report presets. Invalid ISO dates, reversed From/To ranges and impossible leap-day dates are rejected; report tables and CSV exports are withheld on invalid windows while date controls remain editable.
4. **Unread badge:** header notifications require a verified, nonnegative integer owner-scoped exact unread count. Backend read failures or missing count now show a neutral `?` indicator, not a falsely verified zero. Owner-scoped realtime and stale-response protections remain.
5. **Safety:** all changes operate inside already approved browser route gates and **do not** expand RLS, re-enable integrations, release payment operations or create more sensitive data retrieval. Report source-integrity checks are not a substitute for independently reviewed server authorization and hosted UAT.
6. **Regressions:** `security/build130/report-source-integrity.test.mjs`, `notification-badge-integrity.test.mjs` and `scorecard-progression.test.mjs` exercise these safety and acceptance invariants. Both fast and guarded CI must test the exact final SHA; do not infer results from prior commits.

## Live nonproduction lab audit (read-only, 14 Nov 2026)

Queried isolated Supabase project `dhlhlasnaapzckjyvffn` using management read-only SQL and table inventory:

| Measure | Observed |
|---|---:|
| Project health | ACTIVE_HEALTHY |
| Public base tables | 19 |
| Public tables with RLS enabled | 19 |
| Actual Auth users | 0 |
| Exact public table rows (19 separate `count(*)` columns) | 0 |
| Public RLS policies | 0 |
| Enabled public application triggers | 0 |
| Signed hosted UAT accepted | 0/140 |

A healthy database with zero policies and no actual test accounts **does not prove authorized role access**. No fixture contents were downloaded; no writes, privileged Auth Admin actions or persistent database changes were performed.

## Critical dependency graph

1. **Repo admin**: enable protected main, independent review requirement, no bypass and substantive CI requirements; verify live readback. No currently exposed GitHub connector action can configure branch protection; direct branch-protection read returned 403 to the integration.
2. **Independent reviewer**: review and approve the *separate*, smaller lab-enabler PR #15 at its exact SHA, including GitHub protected environment settings, independent environment reviewer, protected-main-only dispatch, secret isolation and manual approval. ChatGPT cannot approve its own source.
3. **Lab owner**: use PR #15's separately approved, protected manual workflow to verify `AUDIT_ONLY` then create exactly 9 **fictional** hosted GoTrue accounts and 38 inert rows in the already isolated project, with no production credentials and no notification sends. The source alone does not count as actual hosted setup.
4. **UAT/security owners**: review exact RLS grants and run 140 signed hosted cases, accept 48 production remediations and verified rollback/PITR. Independent HR/legal/privacy/finance approvals and nine release signoffs must be complete before protected main merge/production deploy.

**Important:** an issue comment, a draft test, a preview deployment, and a manager's broad authorization cannot be substituted for the independent evidence specified in the fixed acceptance rubric.

## Unresolved technical limitations

- The report integrity check is intentionally strict. If the legitimate database uses different historic identifiers or role-invisible linked records, it will refuse to publish partial KPIs until a reviewer approves a defined, privacy-safe reconciliation model.
- Per-browser reports are still capped to **2,500** verified rows per source by the older read transport, and shared CRM grids fail closed above 250. Real high-volume pagination/approved aggregates remain required for production at scale.
- No completed nonproduction RLS role matrix or independent production permission audit was observed. No accepted programme milestone was closed by this code-only build.

**Programme score:** Build129 26/100 → Build130 26/100; no acceptance inflation. The number of remaining builds depends on whether the independent admin/reviewer and lab controls actually close.
