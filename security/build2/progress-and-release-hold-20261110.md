# Build 2 progress and release hold — 2026-11-10

**Draft only. No production authorization.** This is a workstream progress estimate, not an audited percentage or a release gate.

## Latest verified checkpoint
- Commit: `d81c06491aa5fd35337660e31620b39c6dfc946f`
- Step35E: GitHub Actions run 42765023782 — SUCCESS.
- Build2: GitHub Actions run 42765023838 — all three jobs SUCCESS (application/typescript, offline security, disposable PostgreSQL).
- A raw schema-only dump hash was unsuitable for comparing restored databases; the replacement deterministic catalog fingerprint passed in disposable PostgreSQL.
- Live read-only catalog snapshot confirmed 19 public base tables, 13 views, 16 SECURITY DEFINER functions; 13 anon-readable views and 16 anon-executable definer functions. These remain risk findings, not mitigations.
- Connected nonproduction Supabase database had no public application schema; it is not a schema-equivalent migration test environment.

## Indicative completion by workstream
| Workstream | Estimate | Status |
|---|---:|---|
| Historical/live security inventory | 100% | Current object counts and inventory verified, not safe access |
| Draft security policies and controls | 90% | Draft-only; compatibility blockers remain |
| Offline security and negative authorization tests | 85% | Synthetic scope passes |
| Application build and integration checks | 85% | Build/typecheck pass; full browser and live-role flows outstanding |
| Synthetic backup and rollback rehearsal | 80% | Disposable restore and catalog comparison pass; no full production-shaped restore |
| Production-schema-equivalent authorization tests | 30% | No complete equivalent test database |
| Independent review and release readiness | 15% | No approval; evidence gate remains blocked |

**Overall rough planning estimate: 65%.** Not a weighted empirical metric and not a production release decision.

## Remaining priority actions
1. Prepare complete schema-equivalent disposable PostgreSQL with synthetic rows, reconcile all current column types, defaults, constraints, indexes, triggers, dependencies and grants. Do not copy business data.
2. Run exhaustive role and negative authorization matrix for anon, unapproved, recruiter A/B, admin, finance, integrations; include ownership reassignment, confidential columns, views, RPC and trigger side effects.
3. Validate admin approval/role workflow replacements and recruiter creation paths against the proposed policies, plus browser-level regression tests.
4. Rehearse complete schema-equivalent backup/restore and exact forward/reverse migration, including checksums and failure rollback.
5. Obtain independent security review, approved release evidence, maintenance/rollback plan and explicit release authorization.

All nine entries in `security/build2/release-evidence.json` remain `passed:false`. No staging or production writes, merges, deployments, external communications, or financial activation authorized.

## Consolidated batch milestone — 2026-11-10
- Latest fully green prior checkpoint: `126d6465` (Build 2 and Step 35E); subsequent privilege tests and documentation require their own CI checks.
- New machine-readable `authorization-acceptance-matrix.json` defines 20 synthetic scenarios × seven role contexts = **140 provisional expected outcomes**, including cross-recruiter access, confidential columns, views, RPCs, stage history, bulk unknown-commit outcomes, role escalation and financial inactivity.
- `authorization-acceptance-matrix.test.mjs` checks role completeness, uniqueness and fail-closed high-risk defaults. These are **contract checks, not executed database/browser authorization evidence**.
- Policy-sensitive expectations (assignment, deletion, admin, finance and integration scopes) are **proposed security baselines** pending explicit management confirmation; they do not supersede approved company policies.
- Progress reporting rule: mark a milestone complete only when its acceptance evidence is green. A commit or additional planned scenario does not increase the overall estimate. Maintain provisional ~69% until an entire blocked workstream has been verified.
- Batch next: obtain approved schema-only source; validate scope and private fingerprints; build disposable equivalent; execute 140 scenarios and capture actual vs expected results; independently review differences; then rehearse full rollback and browser flows. No automatic promotion or release-gate changes.
