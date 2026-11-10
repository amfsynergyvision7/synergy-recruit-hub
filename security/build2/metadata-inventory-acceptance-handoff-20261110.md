# Metadata-only CRM security inventory: acceptance handoff
Date: 2026-11-10
Status: DRAFT / NO LIVE ACCESS / RELEASE HOLD
Validated source commit: `05c3676e3fcc4c2c69f8970a03060f5676397a41`

## Verified automated evidence
- Step 35E GitHub Actions run `42763956408`: SUCCESS.
- Build 2 GitHub Actions run `42763956467`: SUCCESS.
- Build 2 jobs `application-typescript-check`, `offline-security-tests`, and `isolated-postgres-view-rls`: SUCCESS.
- Metadata-only recipe `security/build2/metadata-snapshot-readonly.sql` contains twelve SELECT statements covering policies, RLS state, table and column grants, views, functions, triggers, exact columns, constraints, and per-API-role privileges.
- `metadata-snapshot-readonly.test.mjs` enforces SELECT-only statements and no direct FROM/JOIN on business schemas. This is a static test, not a proof that future edited SQL cannot have side effects.
- Release gate `release-evidence.json` retains nine `passed: false` flags; no release condition is claimed cleared.

## Safe execution prerequisites (not satisfied here)
1. Identify an explicitly approved, read-only database connection and authorized operator; do not use service keys in chat, logs or GitHub.
2. Obtain approval for metadata-only inspection of the target environment. Do not inspect candidate/customer data.
3. Run the read-only recipe through a restricted read-only session. Prefer a read-only transaction, statement timeout and output sanitization. The function/view definitions may embed literals and therefore must remain private.
4. Save a dated, access-controlled inventory outside the public repository, with object counts and checksum. Do not publish raw definitions, credentials, record contents or personal information.
5. Reconcile each of the 19 table names, 13 views and 16 definer-function signatures against the current metadata, then create an exception register for mismatches. Historical counts are not a substitute for a new inventory.
6. Prepare actual-schema-shaped synthetic fixtures and negative tests. Never substitute synthetic success for actual current schema compatibility.

## Required negative-role matrix
| Actor | Required denial/proof |
|---|---|
| anon | No sensitive table, view, function or export access |
| pending, rejected, suspended or inactive | No private read/write even with a valid session |
| active Recruiter A | Own authorized records only; cannot reassign ownership or edit approval fields |
| active Recruiter B | Cannot read or mutate Recruiter A records through joins, views, RPC or exports |
| operations | Only explicitly assigned and approved operations; no candidate contact/resume/salary through AI |
| finance | Explicitly authorized operational billing only; AI Finance remains denied |
| viewer | Approved minimal read-only projections; no private write |
| admin | Approved workflows function without self-escalation or unsafe blanket grants |

For every actor test SELECT, INSERT, UPDATE, DELETE, column-level writes, view access, RPC EXECUTE, trigger side effects, refresh and exports; check both database state and UI feedback.

## Release acceptance
- Full 19-table operation-by-operation policy review and migration/reverse migration.
- Reconciled 13 view definitions and 16 privileged-function signatures, ownership, search paths, EXECUTE grants and dependencies.
- Browser regression and real-schema-shaped negative tests.
- Backup/restore proof in approved isolated synthetic environment, including before/after checksums.
- Independent security review, risk owner, rollback owner, maintenance window and **separate explicit release authorization**.

**No live inspection, staging or production database write, branch merge, deployment, external AI/SMTP activation or financial workflow activation is authorized by this document.**
