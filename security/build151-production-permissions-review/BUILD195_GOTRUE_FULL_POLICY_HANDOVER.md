# Build 195 — GoTrue-issued JWTs against the exact full 35-policy proposal

**16 November 2026 · DRAFT review evidence only · NO hosted SQL, merge or deployment.**

## Material advance beyond Build194

Build194 tested the corrected caller-bound `public.has_role` from PR #23 against the actual proposed 35-policy SQL in a disposable PostgreSQL transaction, with a simulated `auth.uid()` session. The earlier Build189 test issued genuine GoTrue test JWTs but used a *small test policy schema*, not the actual proposed 35 policies. Those two validations were not the same system.

**Build195 now combines the reviewed source-pinned full 67→35-policy/48-object SQL from PR #16, the corrected exact role-helper from PR #23, a disposable GoTrue issuer, and PostgREST 12.2.3 in the *same* isolated PostgreSQL 17 database.** Actual GoTrue password-logins produce valid signed tokens. A PostgREST HTTP request verifies the token, sets the appropriate database role and per-request JWT claims, and evaluates the **actual proposed 35 RLS policy expressions** against fictional records.

### Fully disposable evidence chain

The new test job starts a dedicated `amf_build195_gotrue_35_policy_lab` database in an **ephemeral GitHub Actions PostgreSQL 17 service** and applies Git-blob-verified source snapshots. The original PR #16 proposal includes `BEGIN/COMMIT`; unlike the transaction-only Build192 replay, Build195 **commits that exact draft SQL solely in the disposable CI database** so GoTrue and PostgREST can read it in their separate sessions. A strict localhost, database-name, owner and CI-flag guard prevents running through this test harness against a hosted project. All test identities, resumes, audit events, billing, notifications and other records are entirely fictitious; the test does not contact a production CRM, sender, real applicant or financial processor.

Source integrity is checked before running:
- Existing full 67→35-policy source Git blob: `484c251cdbfd932bdab5ffcf039a107e7478633e`
- Corrected PR #23 caller-bound helper snapshot: `309b62681dd6ce221f24733766aa9b48da845c8f`
- Original 67-policy catalogue snapshot: `59ac1f0d25215333868012fdb8e6b9382ed12e14`
- Existing synthetic 19-table/13-view/16-function database schema: `858542a266e0052124b486610a3eac7266b63ddc`
- Disposable GoTrue Auth schema: `27058f2f2c3f91552686a02cea3e9110132bb0cd`

The original PR #16 and PR #23 DO-NOT-APPLY SQL bodies were **not edited**. The only test-only privileged body substituted after applying the draft is `public.is_approved(uuid)`, which checks a fictional approved-and-active profile. All other 16 pre-existing privileged helper/trigger bodies in this source-shaped database are still fixtures, not production-equivalent business logic.

### Auth compatibility failure found and corrected in the test fixture

The first successful JWT login still yielded zero visible fictional rows. A failing test made that mismatch explicit. Diagnosis proved the caller's RLS role was authenticated, while the fixture's old `auth.uid()` read only `request.jwt.claim.sub`; PostgREST 12 supplies JWT claims in the JSON `request.jwt.claims` setting. The fixture now checks both settings using `coalesce` (as documented in modern Supabase auth helper migration guidance). The **production role helper and draft policy predicates were not weakened or changed** to make these tests pass. The suite now asserts that an issued JWT resolves the caller's own role and visible profile.

Supporting references: [PostgREST 12.2 JWT transaction settings](https://postgrest.org/en/v12/references/transactions.html), [Supabase Auth helper migration](https://github.com/supabase/auth/blob/master/migrations/20220224000811_update_auth_functions.up.sql).

## Verified final CI result

[**GitHub Actions run #43850438754**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43850438754) — **all four substantive jobs SUCCESS**:

- **32/32** source-contract tests pass.
- **25/25** adverse PostgreSQL permission/policy simulations return expected HOLD and rollback.
- The earlier **source-pinned full 67→35 migration rehearsal** still executes, checks exact policy predicates, and rolls back to the original 67 policies.
- **58/58** *actual GoTrue-issued JWT → PostgREST → exact 35 proposed policies/PR23 helper* API assertions pass. These cover five fictional users (approved admin, two recruiters, finance, and pending admin), self/foreign role lookup, strict NULL-target FALSE, role visibility, owned/cross-recruiter candidate/job/submission/interview/stage-history rows, finance/audit separation, pending account denial, anonymous private-table denial, allowed branding columns and denied private branding, invalid JWT rejection, candidate INSERT and stage UPDATE, denial of candidate reassignment, notification-read updates, denial of recipient changes, role-table write refusal, and admin-only submissions.

The run also explicitly verifies **both** `REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE` and `REVIEW_ONLY_EXACT_35_POLICY_SOURCE_MATCH_NOT_RELEASE` on the committed *disposable* database, then stops GoTrue/PostgREST, deletes the database, and verifies **`BUILD195_EPHEMERAL_DATABASE_REMOVED_VERIFIED`**. No live database change occurred.

### Exact new source files

- [GoTrue schema snapshot](./build195-gotrue-auth-base.disposable.sql)
- [Source-pinned fixture and installation generator](./build195-prepare-full-gotrue.disposable.mjs)
- [Strictly disposable test/cleanup runner](./build195-run-disposable-gotrue-35-policy.sh)
- [58 HTTP integration assertions](./build195-full-gotrue-35-policy-http.test.mjs)

## What it does NOT certify

**This is not hosted Supabase UAT.** It does not authenticate against the company's actual Supabase Auth project, verify production tokens or keys, replace the production `is_approved` body, run all real trigger/helper bodies, test current email/outbox reconciliation, service-role callers, database backup/PITR, full application UI, legally approved business authorization, live audit writers, financial workflows, or any externally integrated server/Edge code. The fake JWTs are issued by the real GoTrue software **inside CI**, not by the hosted company tenant. The 58 checks cover selected rows/actions—not the full 140 independently signed hosted UAT scenarios.

**Latest production read-only release status:** original 67 RLS policies and original role-helper metadata unchanged; the draft permission and helper remediation remains unapplied. `main` is still unprotected, PR #16 and PR #23 are drafts with no independent reviews. No company-specific policy or legal signoff was invented.

**Required independent handover:** security/DBA must privately confirm production incident risk, approve coordinated PRs #16/#23/#18 and non-PR service callers, reconcile the actual production `is_approved` and definer/trigger bodies, verify production-style signed Auth/RLS and 140 hosted fictional-record UAT cases, restore/PITR and rollback, protect `main`, obtain independent PR reviews and nine release signatures before controlled deployment. This source-level validation is intended to accelerate those reviews, not replace them.

**Formal programme acceptance still 26/100; 12/43 milestones accepted, 31 open. Category C remains 6/10 (LD02 and LD05 unaccepted); 0/48 accepted live production security remediations, 0/140 hosted UAT cases accepted, 0/9 release signatures. DRAFT / RELEASE HOLD / NO MAIN MERGE OR PRODUCTION DEPLOYMENT.**

*Public-repository caution:* Do not add production connection strings, live JWTs, personal records, secrets or detailed incident/exploitation findings to this GitHub review.
