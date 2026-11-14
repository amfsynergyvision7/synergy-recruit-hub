# Build 137 — Strict GlobalSearch preview and independent nonproduction Auth-lab handoff

**Scope:** Draft source PR #12 only; no branch protection bypass, production/staging SQL writes, synthetic account provisioning, external outreach, financial activation, PR merge or deployment.

## 1. Build136 baseline actually verified
- Exact previous Build136 head `d22d37b08b87fba2012e48d749f9d32cdf2871eb`.
- [Build136 fast CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43589996334): SUCCESS, **868/868 offline + 11/11 separate candidate/finance safety = 879/879 tests**, plus Vite application build and TypeScript.
- [Build136 guarded CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43589996316): **36/37 jobs passed**, only `production-release-hold` failed intentionally.
- `main` at `c735292fbace6605d691a68b602a02b2c6f9e137` remains unprotected, no rulesets; PRs #12 and #15 each have zero independently submitted reviews.

## 2. Source delivery: global search integrity

`src/components/GlobalSearch.tsx` previously trusted every PostgREST `data` row as a candidate, client or job suggestion, with unconditional `any` fields, and displayed up to six entries without telling the user that this is a preview. New `src/lib/global-search-results.ts` performs all-three-bucket runtime decoding atomically. It rejects missing/null/nonarray or over-six page results, blank/duplicate IDs, empty or malformed module labels, unexpected nullability and hostile secondary values. A failure in **any** of the three buckets withholds all suggestions and shows a generic unavailability indicator; no raw backend diagnostic is displayed. The three queries remain narrow, RLS-governed, abortable and account-scoped by the approved CRM shell; ID-ordered limits remain six per module. The UI visibly describes a preview, not a complete CRM or definitive absence of matches. No new database roles, grants, writes, dependencies or external effects introduced.

`security/build137/global-search-preview-integrity.test.mjs` covers valid mixed buckets, Unicode and source values, null malformed data, ID duplication, adversarial labels, exact six-row preview cap, missing bucket, stale request cancellation and approved-account mounting. Existing Build117 source/injection tests remain enforced in both fast and guarded CI.

## 3. Source delivery: exact nonproduction Auth readiness

- Focused independent reviewer checklist: `security/build137/nonprod-auth-parity-review.json`, with no credentials or SQL writes; test `security/build137/nonprod-auth-parity-review.test.mjs` validates against unchanged historical `security/build47/catalog-inventory.json`, `security/build72/live-function-public-acl-snapshot.json` and recent lab-only `security/build136/read-only-lab-object-evidence.json`.
- Fresh read-only lab `dhlhlasnaapzckjyvffn` query (14 November 2026): 19 public tables with forced RLS, 13 invoker views, only 7 security-definer public functions, 0 policies, 0 Auth users, 0 enabled public application triggers, 0 anon/authenticated SELECT grants on public tables and **exact zero rows in all 19 public tables**. These demonstrate *deny by default*, not working permissions for signed recruiters/administrators.
- Historical reference contains 16 privileged function names, nine not present in this **isolated lab**:
  - **P0 — auth/role authorization:** `get_user_role(uuid)`, `has_role(uuid,app_role)`, `is_approved(uuid)`, `handle_new_user()`.
  - **P1 — mapping/schema:** `resolve_candidate_uuid(text)`, `resolve_client_uuid(text)`, `resolve_job_uuid(text)`, `rls_auto_enable()`.
  - **P2 — potentially consequential automation:** `generate_reminders()`, to remain held until separately approved.
- The reference is historical, and a function absent in the test lab must **not** be claimed absent from current production. No function was installed, invoked, or copied from production.
- PR #15 is still **open, reviewable and unmerged**, with independent submitted reviews **0**; its [latest-head CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43502912428) passed. The manual-only runner already requires a protected `main`, an independent approval at exact PR #15 SHA, protected independent GitHub Environment `amf-nonprod-auth-review`, isolated lab secrets and fresh read-only preflight. The available GitHub connector did **not** permit checking GitHub Environment configuration; therefore its existence and protections are **unverified**, not asserted absent.

## 4. Actionable release/owner handoff

1. **Repository administrator** enables protected `main` and required substantive CI, disallows force-push/bypass, and requests a genuine independent review of [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15). Do not use the author or automation as independent reviewer.
2. **GitHub Environment owner** verifies `amf-nonprod-auth-review` has a separate required reviewer, self-review prevention, protected-branch-only deployment policy, and exactly the lab-only service/secret and random synthetic password master, stored as confidential environment secrets. No credentials pasted to chat or issue.
3. **Independent database/security owner** verifies exact signatures of the nine missing functions using current isolated lab metadata and a separately authorized *current* production metadata read; review least-privilege policies, source definitions, function search paths, grant inheritance and trigger side effects. Draft and approve test-only dependencies, keeping candidate/financial/automation writers disabled. This is prerequisite to a meaningful signed-user RLS test, not a blanket function-creation request.
4. **Authorized lab operator**, only after the separate review/security approval, runs PR #15 `AUDIT_ONLY` and the fresh preflight. If accepted, provisions precisely nine fictional Auth users and 38 inert synthetic rows in the lab. If an account/record already exists, use manual reconciliation rather than destructive auto-cleanup.
5. **UAT/security owners** execute 140 signed role/HTTP cases (including five controlled writes), the 48 individually accepted production permission remediations, PITR/rollback rehearsal and nine formal release signoffs. Production deployment and joining/billing effects remain blocked until every gate passes.

## 5. Fixed acceptance and planning

The 43-gate immutable acceptance ledger remains **26/100, 12 evidenced, 31 open, 74 points unearned**; protected merge readiness remains **0/8**. Nonprod Auth 0/9, inert records 0/38, signed hosted UAT 0/140, accepted production remediations 0/48, release signoffs 0/9. This build adds code and a reviewer-ready evidence package **but no independently accepted release milestone**.

Approximate milestone-closing work: ~16–31 further accepted-milestone builds at one or two independently signed gates per build, optimistically ~11 at three. This is conditional arithmetic, not a dependable date or countdown while administrative protection, protected environment and genuine reviews remain unavailable.

**Verification policy:** exact final Build137 SHA must pass fast offline tests, separate candidate/finance hold tests, application build and TypeScript, and all substantive guarded jobs. The intentional `production-release-hold` remains red. No intermediate green run counts as final-head proof.

All work in Build137 is draft-only; no SQL/database changes, PR merge, production deploy, candidate billing activation or external customer communication was performed.
