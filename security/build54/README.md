# Build 54 — Deterministic Combined Release Bundle (Strict HOLD)

Four exact source fragments are stitched into **one** draft release candidate:
1. Build49 exact 67-policy fingerprint, 48-object lockdown → 35 restrictive policies and auditable account/profile RPCs.
2. Build51 candidate stage RPC, non-financial target allowlist and audit.
3. Build52 candidate create/update RPC, column-level privilege revocation, monotonic version trigger and workflow-rule fail-close.
4. Build53 private-ledger idempotent atomic candidate import RPC.

`assemble-release-review.mjs` generates two artifacts in `/tmp/build54-release-review`:
- **release-review-hold.sql**: unconditional first-statement exception, then one guarded transaction ending in ROLLBACK. This is **not a deployable migration**, intentionally.
- **full-release-rollback.integration.sql**: actual same source fragments exercised against the Build49 synthetic production-shaped fixture and combined Build53 stage/detail/import cases. The entire transaction rolls back. No release authorization and no hosted database write.

A cryptographic manifest records the SHA256 of each source and composed SQL. Any baseline-anchor drift, accidental COMMIT, missing 67-policy fingerprint or missing admin RPC fails the builder. CI asserts the guard and hashes before PostgreSQL execution.

## What this does NOT demonstrate

- Genuine hosted Auth users/browser API request acceptance (still 0/140).
- Financial/retention policy approval, irreversible deletion, or compatibility of every untested CRM screen.
- Real production backup restore/roll-forward or permission to deploy.
- PR #11 behavior-level integration, independent reviewers and branch protection.

**Policy:** draft-only and isolated rollback tests. Do not remove the release stop, write to production/staging, publish, merge to main or activate billing.

## Build55 safety correction — no executable DDL after a failed guard

A `psql` client that does **not** stop on SQL errors can continue executing later statements. Therefore a `DO RAISE EXCEPTION` followed by executable policy changes is **not** truly non-executable. Build55 corrected the output: `release-review-hold.sql` contains **only** the unconditional refusal plus comments—**zero migration DDL/BEGIN/COMMIT/ROLLBACK**. The full proposed migration is separately written to `release-candidate-HUMAN-REVIEW.md` as a fenced code block with prominent HOLD markings, and CI hashes it. The sole runnable SQL is the disposable rollback-only PostgreSQL fixture. This correction reduces accidental execution risk without authorizing deployment.

## Build55 readonly deletion-impact addition

The review release candidate now includes a fourth candidate RPC: `crm_candidate_delete_impact(uuid)` (admin-only, count-only, no DML). It is **not** an authorization to delete. The generated source manifest now contains five SHA256-pinned fragments and the disposable full combined migration includes additional administrator/recruiter role tests. This does not alter the strict release hold.

## Build56: finance HOLD on two source-verified joined paths

The human-review release package now includes a sixth SHA256-pinned source fragment: `security/build56/financial-joined-transition-hold-review-only.sql`. It adds a BEFORE guard function plus two enabled triggers, blocking joined candidate/offer transitions and reversals before the existing legacy AFTER triggers can automatically bill. A new exact-source synthetic fixture reproduces the two-bills-from-one-offer risk and demonstrates that the guard prevents both routes. Full 67→35 policy replay includes further blocking tests. This is **review-only**; finance/legal review and hosted-user UAT remain mandatory. No financial workflow is enabled.

## Build57: Server-authoritative invoice write lockdown

The combined review-only migration now SHA256-pins a seventh source: `security/build57/billing-write-lockdown-review-only.sql`. It revokes direct invoice INSERT/UPDATE/DELETE/TRUNCATE plus explicit column grants for all API roles including service_role, and installs separate always-fail BEFORE triggers for row DML and TRUNCATE. The generated postflight insists both triggers are enabled and **no API role retains table/column write grants**. The disposable full 67-to-35 RLS fixture verifies this while retaining pre-existing synthetic invoices. This may break legitimate service-role finance jobs and therefore **requires separate finance/operations approval before any actual deployment**. No production/staging mutation is authorized.

## Build58: 8th source-pinned legacy function hardening

The latest combined review migration now includes eight SHA256-pinned SQL fragments. Build58 validates production source fingerprint `ea5005b2208a2d0891e3f8004fd7de80` and the exact post-Build49 intermediate fingerprint `f0e40a79b530175737b188ab4bb479d2`, then fixes all four mutable-search-path function configurations while removing anonymous direct execution privileges. The combined synthetic original 67→35 policy rehearsal PASSED in a single transaction that ROLLS BACK. This does not mean the live security advisor's four issues have been remediated; production remains unchanged.
