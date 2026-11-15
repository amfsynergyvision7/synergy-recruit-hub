# Build 151 — Isolated production permissions review package

**DRAFT ONLY / DO NOT APPLY / DO NOT EXECUTE / DO NOT MERGE FOR DEPLOYMENT.**

This packages ten **byte-for-byte Git blob pinned** artifacts from existing draft PR #12 (`b2734b14c0e19d2ce2b8daa87655ca18c2d932d6`) into a focused branch based on current `main` (`c735292fbace6605d691a68b602a02b2c6f9e137`). It makes the 19-table / 13-view / 16-privileged-function security work independently reviewable rather than asking an approver to navigate PR #12's 504-file diff.

No production or staging database writes were executed and no business/customer rows were accessed. This draft does **not** count as a remediated object or an approved migration.

## What is in this package

- `baseline-48.json`: previously assembled exact 19/13/16 scope and key RLS policy risk.
- `production-preflight.readonly.sql`: unchanged, one-statement metadata-only SQL; **safe for a read-only authorized operator** after inspecting the query.
- `lockdown.DO-NOT-APPLY.review.sql`: original Build47 prospective transaction. **DO NOT EXECUTE.** It includes `COMMIT`, privilege changes and removal of 15 broad RLS policies, but does not supply the complete replacement for the remaining 67-policy authorization model. Running this in isolation can break existing workflows and must not be done.
- `disposable-rehearsal.DO-NOT-RUN.sql.txt`: source-pinned previous disposable PostgreSQL 17 transaction, guarded by exact disposable database name and ending in `ROLLBACK`. Archived for reviewers only; not executed by CI or this build.
- `source-manifest.json`: original paths, immutable Git blob hashes, fresh production catalog-only findings, and unchanged **0/48** production acceptance.
- `review-contract.test.mjs`: built-in Node tests validating source immutability, exact scope, single-statement preflight, fail-closed guardrails, disposal-only rehearsal and absence of accepted signoffs.
- A separate no-secret GitHub CI workflow verifies the review package. No database connections are made by that workflow.

## Current production catalog findings (READ ONLY, 15 November 2026)

The source-pinned Build73 preflight returned `HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT` on the production project. Of 19 public tables, 19 still grant `TRUNCATE` to both `anon` and `authenticated`. All 13 expected views are non-`security_invoker` and readable by `anon`. All 16 expected privileged functions are executable by `anon`, including 9 executable by the `PUBLIC` pseudo-role. **Nothing has been applied.**

PostgreSQL TRUNCATE is not controlled by row-level security and requires its own privilege; security-invoker views and restrictive function execute permissions need independent application compatibility tests.

## Mandatory independent release prerequisites

1. **Production DB/security owner** compares the current 48-object catalog, original SQL and all 67 existing RLS policies against the proposed complete replacement (which remains in PR #12). Prepare a combined, source-verified, atomic deployment plan with full service functionality, role constraints and stop/go criteria. Do not blindly apply the partial Build47 review file.
2. **Qualified CRM/UAT owner** signs off real browser/API flows (including admin, recruiter, operations, finance), all 140 hosted cases and privileged function caller compatibility; test on an independently authorized isolated environment first. Any policy needing finance/legal signoff stays inactive.
3. **Backup/restore owner** signs off PITR and restoration rehearsal, dependency review, reversible roll-forward strategy and objective fail-safe rollback. Reinstating the unsafe previous grants is **not** a safe production rollback.
4. **Repo administrator and independent security reviewer** enable protected `main`, enforce genuine independent approvals and required tests, approve the exact reviewed release source. No branch-protection bypass, auto-merge or self-review.
5. **Release owner** obtains the 9 formal signatures, completion of the broader PR #12 integration and approved communications/financial/legal processes before any production deployment.

**Result for Build 151:** Packaging, evidence preservation and offline review CI only. **0/48 live production objects remediated; 0/48 independently accepted.** The separately blocked nonproduction Auth/UAT rollout, hosted UAT and D-003 financial/legal holds are unchanged. This PR must remain a **draft** until all prerequisites and reviewer feedback are satisfied. It is **not a production deploy request**.

Official technical references: https://supabase.com/docs/guides/database/postgres/row-level-security ; https://www.postgresql.org/docs/current/sql-revoke.html ; https://www.postgresql.org/docs/current/sql-truncate.html

## Build 152 — full 67-policy and account-RPC review dependencies

This extends the narrow draft review PR #16 with **six additional byte-for-byte Git-pinned artifacts** from the existing 504-file PR #12; the four original sources remain unchanged. The new files are `baseline-67-policies.json` (live catalog snapshot), `legacy-67-policies.DO-NOT-RUN.sql.txt` (inert source replay for disposable use only), `complete-67-to-35-with-rpcs.DO-NOT-APPLY.sql.txt` (proposed 35-policy replacement plus two account administration compatibility RPCs), `admin-account-rpc.DO-NOT-APPLY.sql.txt`, `self-profile-rpc.DO-NOT-APPLY.sql.txt` and `prior-source-fingerprints.json` (earlier database source observations). These are **not a deployable migration**: no new SQL is placed under `supabase/migrations/`; every executable-looking addition is archived as `.sql.txt` and must not be executed.

**Fresh production READ-ONLY policy observation (15 November 2026):** the public `pg_policies` catalog contains **67** existing policies across **18** tables, including **15** broadly permissive `ALL` policies. The live exact digest `a70190f31ed8436b2989082898a02b51` matches the Build49 proposal's expected original catalog digest. This proves **source compatibility at observation time only**, not the correctness of the proposed 35 replacement policies and not approved business authorizations.

Added `policy-fingerprint.readonly.sql` as a separate single-SELECT, catalog-only policy source gate. It can report `SOURCE_MATCH_REVIEW_ONLY_RELEASE_HOLD` or `SOURCE_DRIFT_RELEASE_HOLD`, **never** an acceptance or deployment PASS. The new offline tests independently recompute the 67-policy digest, check the exact policy count and 15 broad grants, compare source fingerprints and verify both account-management RPCs are present and the replacement declares **35 proposed policies**.

**Unresolved independent reviewers' decisions:** proposed admin role/profile changes and self-profile RPC semantics, recruiter/finance/browser operations, 67-to-35 policy impact, integration with all 48 object grants, 140 signed hosted UAT cases, 48 accepted production remediations, PITR/restore rehearsal, legal and finance acceptance, and nine release signoffs. DO NOT APPLY or merge the review-only SQL by itself. The PR remains DRAFT with zero independently approved production fixes.

### Build152 exact catalog checksum validation

The earlier review CI caught a sorting mismatch: JavaScript `localeCompare('en')` and PostgreSQL catalog name ordering handle mixed-case policy names differently. An independent read-only comparison showed **zero row-level differences** across all 67 policies, and the rows at positions 25–29, 51–53 and others were ordered differently due to collation alone. The offline test now uses binary/C-style ordering, matching PostgreSQL's existing live digest `a70190f31ed8436b2989082898a02b51`. No baseline, policy expression, privilege or business row was altered.

## Build 153 — Table-by-table RLS and privilege impact review

Added a deterministic, no-network source comparison that makes the 67-existing to 35-proposed RLS change independently reviewable at **all 19 public tables**. The machine-readable `policy-impact.json` and human-readable `POLICY_IMPACT_MATRIX.md` are generated exclusively from the two exact Git-pinned PR #12 sources already included here. `policy-impact.mjs` is a parser/reporting module only; **it does not connect to Supabase or execute SQL**. CI re-generates the outputs and fails if either drifts from source.

The matrix explicitly tracks **15 proposed removals of universal ALL policies**, **7 tables losing at least one declared operation**, and **1 table gaining an explicitly declared SELECT operation** (`candidate_stage_history`). Audit/activity/email/sync logging paths, settings, notifications, role and profile RPCs are flagged for domain-owner testing. Reviewer assignments and suggested UAT scenarios are recommendations only, not approved policies, completed tests or signoffs.

**Important:** Policy-operation presence is not effective access. PostgreSQL table/column grants, `USING`/`WITH CHECK` predicates, 13 views, 16 privileged functions, triggers and security-definer RPCs must be evaluated together. The current proposed changes can disrupt existing workflow behavior; the extracted SQL is **not a deployable production migration**. This package remains draft-only, production ACL and policy preflights remain HOLD, real signed UAT is 0/140, production security remediations are 0/48, and `main` protection and independent review remain absent.
