# Build 134 — Complete audit and user-role records, held account administration, verified recruiter choices

**Status:** Draft source changes on [PR #12](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12) only. No merge, deployment, staging/production database writes, hosted Auth provisioning, production financial automation, external recruitment communications or independent signoff.

## Verified starting baseline

Build133 PR #12 exact head `29dc9e071ab3698f2ab5d8b577f2b6cd2b5377e9`:
- [Fast run 43585375221](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43585375221) passed **733/733 offline tests, 11/11 separate finance/candidate source guards**, application build and TypeScript compilation.
- [Guarded run 43585375209](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43585375209): **36/37 jobs succeeded**; sole intentional failure `production-release-hold`.
- Main `c735292fbace6605d691a68b602a02b2c6f9e137` remained unprotected with zero repository rulesets. PR #12 draft and PR #15 open, both unmerged, each with zero independent submitted reviews.

## Engineering completed in Build134

1. **Exact-count audit history:** `src/routes/_app.audit.tsx` now mounts a private audit workspace only for an exact verified, approved administrator, keyed by user/role. The former unverified 200-record cap is replaced by complete, ID-ordered, 250-record pages up to a strict 2,500 maximum. Rows are re-sorted newest-first after count verification; bad counts, concurrent count drift, duplicate IDs, aborts and over-cap sources fail closed with no partial timeline or false "No entries" indication. Query is `id, created_at, user_id, action, table_name, record_id` only. **Before/after, email and candidate payloads are not read**; this is not an accepted server RLS or field-privilege audit.
2. **Private user management directory:** `src/routes/_app.users.tsx` now keeps all directory state inside an approved administrator subject/role-keyed workspace. Both `profiles` and `user_roles` use exact-count, unique-ID paging with the same 2,500-record cap, replacing incomplete one-shot 200-record queries. `src/lib/admin-directory-integrity.ts` rejects duplicate user identity, multiple/unrecognized roles, orphan role rows and malformed status/role data rather than displaying an apparently authoritative partial or wrong directory. Valid users lacking an approved role remain distinctly `unassigned`.
3. **Unconditional user-administration hold:** `src/lib/user-administration.ts` now sets `CRM_USER_ADMIN_MUTATIONS_ENABLED = false as const`. The previous public frontend `VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED` toggle can no longer activate sensitive role, approval or activation RPC actions on this draft branch. This does not uninstall a SQL RPC or replace server-side Auth/role policies.
4. **Verified recruiter assignees:** Candidate module's 150-recruiter ceiling is removed. `src/lib/recruiter-selector-read.ts` fetches the entire role-visible recruiter membership in count-reconciled 250-row ID pages up to 2,500. It batches IDs in groups of 100 for narrowly projected `id, full_name` profiles explicitly filtered to `approved` and `is_active = true`, verifies per-batch counts and role membership, rejects duplicated/foreign identities and aborts across account changes. Pending, rejected and suspended profiles are not displayed as assignees. An incomplete selector is visible as a warning and keeps candidate record edits/CSV held even if other CRM data completed.
5. **Shared CRM prerequisite:** `CrudModule` now accepts an optional `requiredReferenceReady` permission prerequisite, default true for unchanged modules, and includes it in its existing `verifiedForMutation` gate. The candidate page supplies the verified recruiter selector status. The unconditional legacy candidate-stage, joined-financial and billing mutation holds remain independently enforced.
6. **Tests:** `security/build134/admin-directory-audit-completeness.test.mjs` and `recruiter-selector-completeness.test.mjs` exercise 201/251/2500/2501 cases, exact counts, identity spoofing, orphan/multiple roles, unknown/missing counts, truncated and stale reads, safe profile batches and zero writes; `scorecard-progression.test.mjs` forbids self-certifying any release milestone. Historical Build123/125/126/127 assertions were updated to the stronger counted source contracts, not disabled. Fast and guarded workflows must pass the final exact SHA.

## Read-only hosted lab state

Supabase project `dhlhlasnaapzckjyvffn` observed `ACTIVE_HEALTHY`. All **19 public tables have RLS enabled**, but **zero public RLS policies**, **zero Auth users**, **zero enabled public application triggers**. Separate read-only `count(*)` queries showed **exactly zero rows in each of all 19 tables**. No SQL changes, Auth accounts, secrets, customer records, triggers, or financial workflows were touched. Therefore **signed hosted UAT remains zero**. A healthy blank lab does not prove that any legitimate recruiter, administrator, viewer or finance role can access required rows securely.

## Formal acceptance and release gates (unchanged)

Fixed weighted programme ledger **26/100**, **12 of 43** milestones evidenced, **31 open**, **74 points unearned**. Protected-merge readiness **0/8**. No new formal milestone is independently accepted by these code-only fixes.

| Gate | Confirmed blocker | Who must close it |
|---|---|---|
| Protected merge | `main` unprotected, zero rulesets | Repo administrator: require independent review, mandatory substantive CI, no bypass/force pushes |
| Small independent Auth gate | [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) open, unmerged, zero independent reviews | Separate approved reviewer at exact SHA; admin sets protected `amf-nonprod-auth-review` Environment with independent reviewer and nonproduction-only secrets |
| Real hosted Auth and fixture | 0/9 fictional Auth identities, 0/38 inert rows | Independent lab owner: only after protected approval, manual `AUDIT_ONLY` followed by reviewed synthetic setup |
| Hosted role matrix | 0/140 signed tests | UAT/security owners: 135 signed HTTP reads and 5 separately controlled writes with evidence |
| Production permission/RPC audit | 0/48 accepted items | Security/DB owners: 19 table grants, 13 views, 16 privileged functions, all reviewed and verified |
| Financial/operations release | 0/9 release signoffs | Finance, HR, legal/privacy and operations owners; PITR restore, monitoring, rollback and no unauthorized external effects |
| Large CRM source review | PR #12 remains draft and unmerged, 0 independent reviews | Separate code/security reviewers, focused changes/scope decisions before protected merge |

**Important:** No GitHub tool exposed for protected-main or environment-secret mutations and the author cannot provide an independent review of its own commits. General management authorization is not a substitute for independent gate evidence. The branch cannot be considered deployment-ready from a green CI suite alone.

## Estimated remaining builds

Milestone-closing scenarios: ~11 builds if three milestones are **independently accepted** per build, ~16 for two, ~31 for one. A planning interval of **16–31** is conditional on protected repo admin, independent reviewer, hosted Auth setup and production security owners performing their required work. At zero newly accepted milestones per build, no finite countdown is credible; adding draft commits alone cannot advance the fixed score.

**Next recommended work:** stop deferring the protected repo/PR15/environment owner handoff; begin real hosted synthetic tests only after formal approval, and use evidence from those sessions to close gates. Code-only audit/directory fixes are not a replacement.
