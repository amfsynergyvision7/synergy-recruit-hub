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
