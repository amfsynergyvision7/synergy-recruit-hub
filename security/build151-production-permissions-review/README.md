# Build 151 — Isolated production permissions review package

**DRAFT ONLY / DO NOT APPLY / DO NOT EXECUTE / DO NOT MERGE FOR DEPLOYMENT.**

This extracts four **byte-for-byte Git blob pinned** artifacts from existing draft PR #12 (`b2734b14c0e19d2ce2b8daa87655ca18c2d932d6`) into a focused branch based on current `main` (`c735292fbace6605d691a68b602a02b2c6f9e137`). It makes the 19-table / 13-view / 16-privileged-function security work independently reviewable rather than asking an approver to navigate PR #12's 504-file diff.

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
