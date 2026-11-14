# Build 135 — Recover the last guarded regressions, complete notification owner reads, and freeze unapproved account/branding writes

**Scope:** Draft PR #12 only. No source merge into `main`, protected-environment bypass, staging/production SQL write, Auth user creation, external emails, company branding publication, candidate-stage change or finance workflow activation.

## Starting result — Build 134 corrective finding

Build134 final exact SHA `ac8d891241941ac60bf6e6a3577179c1d8deb740` passed [fast CI 43586836044](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43586836044): **793/793 offline tests**, **11/11 separate candidate/finance safety tests**, and real Vite build + TypeScript. However, its previously queued [guarded CI 43586836171](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43586836171) subsequently completed with **33 successes of 37 jobs**. Two unexpected failures:

- `build60-pr-reconciliation-and-recovery` still asserted the old, hard-capped `.in("id", ids)` recruiter picker with `count > 150` instead of Build134's fully verified ID pages and 100-ID approved-profile batches.
- `audited-account-and-profile-transaction-review` still asserted a public frontend environment flag could turn on sensitive user-admin RPC writes, when Build134 rightly replaced that toggle with an unconditional hold.
- `substantive-security-summary` failed downstream due to the above; `production-release-hold` was the fourth failure and remains intentionally red.

Build135 updated these two *historical assertions to stronger contracts*; it did not weaken candidate, finance or Auth protections. Future guarded results must separately evidence both source suites.

## Implemented source changes

1. **Notification completeness and ownership:** `src/routes/_app.notifications.tsx` no longer claims 100 notifications represents a complete owner list. The owner-filtered query now uses count-exact, ID-ordered pages of 250 up to a strict 2,500, failing closed for overflow, drifting counts, truncated pages, duplicate/out-of-order IDs, stale requests and missing evidence. After the full read, it sorts newest-first for the prior user experience.
2. **Runtime nullable source verification:** `src/lib/notifications-read-integrity.ts` checks every page's raw database rows before narrowing nullable `user_id` and `is_read` to trusted UI types. A foreign-owner, missing owner, malformed title/date or nonboolean read flag invalidates the entire feed; it is not silently filtered to an apparently complete subset. Exact owner-filtered realtime subscriptions, account-keyed view resets and unmount aborts remain.
3. **Notification read acknowledgement:** `markRead` now refuses actions while the page is loading or incomplete. The update is still scoped by **both notification ID and authenticated user ID**, and accepts success only when exactly one returned row acknowledges both IDs. No test-seed inserts or global notification feeds were introduced. Backend RLS must independently enforce all permissions.
4. **No frontend-triggered self-profile writes:** `src/lib/profile-settings.ts` now sets `CRM_PROFILE_MUTATIONS_ENABLED = false as const` instead of consulting `VITE_CRM_PROFILE_MUTATIONS_ENABLED`; the signed-user RPC code remains for future review but cannot be activated by a public frontend build flag. User-admin roles/approvals remain unconditionally held from Build134.
5. **Organization branding/settings hold:** `src/lib/release-safety.ts` now exports unconditional `CRM_ORG_SETTINGS_MUTATIONS_PAUSED`. `src/lib/admin-settings.ts` refuses `crm_admin_update_setting` before RPC dispatch. `src/routes/_app.settings.tsx` refuses logo upload *before reading file bytes or writing storage*, refuses logo deletion *before storage removal*, and refuses company-default theme changes before RPC. Organization logo controls are disabled and the status is disclosed; ordinary local color-theme selection remains usable. The protected admin-only resume-folder **read** is unaffected; Drive import and candidate/finance/email holds remain active.
6. **Tests:** Added `security/build135/notifications-complete-owner.test.mjs`, `organization-settings-hold.test.mjs` and `scorecard-progression.test.mjs`. The new suites exercise 0, 101, 251, 1,001, 2,500 and 2,501 owner rows; null/foreign identities, concurrent count drift, stale request abort, exactly acknowledged owner-bound read state; and branding storage/RPC holds. Revised historical Build117, Build127, Build129 and Build49 source tests for strictly stronger, compile-validated contracts. Existing release and credit-bearing gate statuses remain unchanged.

These are browser-side guardrails. **They do not disable actual production database rules, uninstall server RPCs, revoke bucket permissions or certify hosted RLS.** Server privileges and signatures require independent owners.

## Read-only nonproduction lab observation

Isolated Supabase project `dhlhlasnaapzckjyvffn` remains `ACTIVE_HEALTHY`. All **19/19 public base tables have RLS enabled**, but there are **0 public RLS policies**, **0 Auth users**, **0 enabled public application triggers**. Independent read-only `count(*)` across each of the 19 public tables returned **0 rows**. No hosted identity, fixture, staging, production or financial write was made. The signed 140-case hosted test matrix therefore remains 0 accepted.

## Release controls and remaining owners

| Gate | Actual position | Next independently authorized action |
|---|---|---|
| Main branch protection | Unprotected at `c735292fbace6605d691a68b602a02b2c6f9e137`, rulesets `[]` | Repo administrator configures PR-only merge, separate reviewer, substantive checks, force-push/bypass restrictions |
| Auth bootstrap | [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) open and unmerged, no submitted independent reviews | Separate security reviewer and protected nonproduction-only `amf-nonprod-auth-review` environment |
| Hosted synthetic principals and fixtures | 0/9 Auth identities, 0/38 inert rows | Gated, approved lab owner runs manual `AUDIT_ONLY` then consented fictional test setup |
| Signed RLS and capability matrix | 0/140 signed, 48 production security remediations unaccepted | Security/UAT owner validates signed JWT roles, column grants, 19 tables, 13 views and 16 privileged functions |
| Final signoffs | 0/9; CRM draft PR #12 unreviewed, unmerged | Independent HR, finance, legal/privacy, security, operations and backups/rollback owners |
| Vercel exact-head deploy | Build-rate-limit failure; no exact-head READY or production rollout | Billing/CI owner investigates plan limits; protected release only when independent gates pass |

**Fixed programme score: 26/100**, 12 of 43 milestone checks evidenced, 31 open and 74 points unearned; **protected-merge gate readiness 0/8**. Source changes and offline tests do not increment independent hosted or production acceptance.

## Expected further builds

Arithmetic only: 31 open credit-bearing milestones imply approximately **16–31 builds at 1–2 *independently accepted* milestones per build**, or ~11 at a sustained 3 per build. These are conditional scenarios, **not a countdown**. No number of additional draft-only commits can substitute for protected branch configuration, independent reviewers, real synthetic Auth/fixture setup, signed UAT, security review and nine release signatures.

**CI standard:** exact final Build135 commit must pass complete fast tests, actual Vite+TypeScript, both independent candidate/financial safety suites, and **all substantive guarded jobs**. The guarded workflow's `production-release-hold` must remain intentionally red. Until its own final exact SHA is checked, do not claim guarded completion.
