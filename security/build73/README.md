# Build 73 — independently repeatable 48-object permission gate

**STRICT DRAFT / NO MAIN MERGE / NO LIVE WRITE / NO FINANCIAL OR OUTBOUND ACTIVATION**

Build73 connects earlier isolated grant/security proofs into one inspectable permission preflight. It does not duplicate the Build54 nine-fragment 67→35-policy and candidate-RPC release rehearsal, nor replace genuine hosted/browser/API acceptance, independent approval or restore testing.

## Actual production and synthetic nonproduction read-only checks

`48-object-release-preflight.readonly.sql` is a **single SELECT statement** querying `pg_catalog` and fixed role privileges only. Its **literal expected scope** is source-pinned to **19 public tables, 13 public views and 16 current `SECURITY DEFINER` function signatures**. It checks existence and absence of unexpected objects; RLS enabled for 19/19; no `anon` or `authenticated` table `TRUNCATE`; all 13 views `security_invoker=true` and no anon view `SELECT`; zero anon or PUBLIC function `EXECUTE`, with exactly three authenticated role-helper `EXECUTE` grants.

The exact query was **executed read-only on both Supabase projects** on 12 November 2026. Captured in `live-permission-gate-observation.json`:

| Object / permission metric | Production | Dedicated nonproduction |
|---|---:|---:|
| Public tables (target 19) | 19 | 0 |
| RLS-enabled tables | 19 | 0 |
| Anonymous table TRUNCATE (target 0) | 19 | 0 |
| Authenticated table TRUNCATE (target 0) | 19 | 0 |
| Public views (target 13) | 13 | 0 |
| Security-invoker views (target 13) | 0 | 0 |
| Anonymous-readable views (target 0) | 13 | 0 |
| SECURITY DEFINER functions (target 16) | 16 | 0 |
| Anon-executable privileged functions (target 0) | 16 | 0 |
| PUBLIC-executable privileged functions (target 0) | 9 | 0 |
| Authenticated-executable privileged functions (target 3) | 16 | 0 |
| **Gate** | **HOLD** | **HOLD** |

These observations are **not a release decision**: the gate is **permission-only**, does not assess the 67→35 RLS policy transition, actual RLS behavior, financial/retention policy, candidate workflow compatibility, 9 signed releases, recovery/PITR, reviewers, main-branch protection or genuine hosted test cases. It must be rerun before any later decision because current results are only a point-in-time snapshot. No business-row data was retrieved.

The nonproduction HOLD reflects **missing actual CRM schema**, not evidence that its existing grants are safe. The required nine synthetic GoTrue accounts and controlled 19-table/13-view fixture lab remain unprovisioned.

## Full source-shaped, rollback-only PostgreSQL check

`48-object-permission-before-after.rollback.sql` is a **disposable PostgreSQL 17 CI-only** test, refusing any database name other than `amf_build73_permissions_lab` before constructing roles, schema objects or grants. It contains a single `BEGIN` and one unconditional final `ROLLBACK`.

Inside the isolated transaction it creates **19 exact source-shaped table definitions**, **13 exact source-backed view definitions** (Build71), **16 harmless function stubs with source-matched signatures** (Build40), and two invented SQL roles. It deliberately recreates the observable unsafe ACL patterns: 19 anonymous and authenticated `TRUNCATE` grants, 13 anonymous-readable owner-mode views, 16 anonymous function grants and nine PUBLIC function grants. The **same 48-object preflight**, translated only to the invented role names, must report `HOLD` before changing anything.

The test then applies only the permission-only proposed control changes in this disposable database: revoke table `TRUNCATE`, set all 13 views to `security_invoker=true`, revoke anonymous view `SELECT`, revoke both direct and PUBLIC function execution, and allow exactly three authenticated role-helper function signatures. The same preflight must then return **`PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL`**. The test deliberately has **zero RLS policies** and asserts that fact, to avoid misrepresenting the permission-only pass as full authorization testing.

After `ROLLBACK`, CI separately checks that no public tables/views, privileged functions or synthetic SQL roles remain, and drops the temporary database. Neither PostgreSQL integration nor live read-only audit reads candidate/client/billing records or runs production function bodies.

`48-object-preflight-contract.test.mjs` and `live-gate-observation.test.mjs` require the exact 19/13/16 source names, SQL hash alignment, zero staging/production mutation, source-safe rollback and the live HOLD results. They are run by the fast workflow and the existing full security workflow. The deliberately failing `production-release-hold` job remains unchanged.

## Release-critical next actions

1. **Independent security and business-owner assessment:** reconcile all 48 live objects, existing nine-fragment Build54 review bundle, required source MD5 fingerprints, legacy 67 policies and proposed 35-policy replacement, view role semantics, trigger/scheduler permissions and app compatibility. Inactive draft SQL is not executable approval.
2. **Hosted synthetic lab:** separately authorize and safely provision the 19-table/13-view/9-GoTrue fixture design under reviewed **32-trigger isolation**. Eight users get profiles/roles; the ninth stays deliberately unprofiled. Disable email, workflow rules, Google sync and billing activation; never copy real candidate or client data.
3. Execute **actual** 135 historical role/table read cases, separately governed five disposable write cases, 16 authenticated-positive and 20 anonymous-negative probes, and current schema/view/function/browser acceptance. Accept only independently verified, source-pinned evidence.
4. Finish and independently verify production-equivalent encrypted backup/restore/PITR, legal/finance/retention decisions, code/PR reviewer sign-off, protected `main`, and all nine formal release gates **before** any production merge or deployment.

**Formal counters unchanged:** **0/48** accepted live production remediations, **0/140** independently accepted actual hosted cases, **0/9** signed security gates, **0/6** full Command Center workstreams closed. The output is **not** an authorization to activate financial operations, contact clients/candidates, publish, merge or deploy.

**Conditional approximate remaining engineering builds:** **6–10+** until a secured CRM merge to `main`; **16–28+** to complete the entire six-workstream AI Command Center including CRM. These are estimates of additional substantive builds, not financial bills, release dates or an evidenced overall completion percentage. If external approvals and a viable synthetic hosted environment do not arrive, the build count is not bounded.
