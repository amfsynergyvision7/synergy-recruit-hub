# Build190 — pinned source-call review and compatibility handover

**Verified 16 November 2026. Static source evidence only, zero hosted writes.**

## Reproducible scope

The CI [read-only caller inventory](./source-inventory.mjs) scanned both pinned source trees with `git ls-tree` and `git show` and printed file-and-line positions without source contents or secrets. Snapshot identity is enforced, and a changed branch tip fails closed.

| Source snapshot | Pinned commit | Files | Runtime | SQL migrations | Direct `.from('user_roles')` | Direct `.from('audit_logs')` |
|---|---|---:|---:|---:|---:|---:|
| `main` | `c735292fbace6605d691a68b602a02b2c6f9e137` | 157 | 131 | 26 | 7 | 1 |
| integration `security/build34-guarded-sync-review-20261111` | `b2734b14c0e19d2ce2b8daa87655ca18c2d932d6` | 198 | 172 | 26 | 6 | 1 |

`has_role` invocation-literal matches were **72 in each tree, all in SQL migrations** rather than the scanned runtime code. These occurrences are mostly policy and function definitions, not 72 independently verified executable callers. **Zero static runtime direct `has_role(...)` or named `.rpc('has_role')` matches were found by this regex.** This does not clear external or dynamic callers. One dynamic `client.rpc(action,...)` pattern was found in the integration runtime at `src/lib/sync-lease.server.ts:58`; inspected source dispatches only three named candidate-sync lease RPCs. `crm_email_confirm_sent_trusted` has no literal match in these two snapshots; its planned implementation is held on other draft security branches, and the named function remains absent in production.

## Reconciled application access locations

**Current `main` tree:**

| Path and relevant location | Observed type | Security implication for release review |
|---|---|---|
| `src/hooks/use-auth.tsx:43` | Browser selects current user's `user_roles` | Verify the signed subject and self-read policy remain valid |
| `src/lib/email.functions.ts:33` | User role lookup before CRM email send | Verify exact role acceptance and outbound effect hold; this source alone does not authorize delivery |
| `src/lib/scheduling.functions.ts:22` | User role lookup before scheduling link action | Confirm authorized admin/recruiter and no release of messaging without approval |
| `src/lib/sheets-sync.server.ts:51` | Service-admin `user_roles` SELECT | Verify service credential isolation and direct table access |
| `src/routes/_app.users.tsx:24,45–46` | Browser role read **and direct role DELETE + INSERT** | A critical application-compatibility review item: sequential browser writes depend on current DB RLS, not merely an `isAdmin` UI check |
| `src/routes/_app.audit.tsx:12` | Browser `SELECT *` of newest 200 `audit_logs` rows | Confirm RLS-admin-only SELECT and data minimization; the current live broad grants/policy remain unsafe irrespective of UI |

**Unmerged integration tree:**

| Path and relevant location | Observed type | Security implication for review |
|---|---|---|
| `src/hooks/use-auth.tsx:65` | Browser role lookup with approved/active profile reconciliation | Verify session reset and role-change cache safety |
| `src/lib/access-gates.server.ts:8` | `supabaseAdmin` direct role query | Confirm privileged client is server-only and remains correctly guarded |
| `src/lib/crm-email-record-access.server.ts:23`, `src/lib/email.functions.ts:46` | Authorized role lookups before email-record/recipient operation | Verify exact-one-role and recipient-bound source guards; external email remains held |
| `src/routes/_app.candidates.tsx:66`, `src/routes/_app.users.tsx:58` | Read-only recruiter/admin directory lookups | Confirm roster reads use actual approved profile and RLS |
| `src/routes/_app.audit.tsx:57` | Role-gated, paginated **metadata-only** audit SELECT | Safer draft UI projection, but does not fix production DB access |
| `src/lib/sync-lease.server.ts:58` | Dynamically named `client.rpc(action,...)` | Source resolves to fixed `crm_claim_candidate_sync_lease`, `crm_refresh_candidate_sync_lease`, and `crm_release_candidate_sync_lease` names; unrelated to `has_role`, but RPC dynamic dispatch requires independent verification |
| `src/routes/_app.users.tsx:82–103` and `src/lib/user-administration.ts:1–42` | Proposed `crm_admin_manage_user` RPC flow; **`CRM_USER_ADMIN_MUTATIONS_ENABLED=false`** | Draft branch removes the browser's direct role delete/insert path and holds account changes until reviewed RPC, real Auth, and live compatibility testing |

## Audit event writer and external-service limitation

The scan found **one direct `.from('audit_logs')` reference on each tree**, in the audit page's SELECT. **No direct `.from('audit_logs').insert/update/delete/upsert` runtime source reference was detected by the initial matcher.** New Build190 source rules additionally classify direct `audit_logs` and `user_roles` mutations and distinguish runtime occurrences from SQL migration definitions. This does **not** prove that no audit writer exists: dynamic SQL, external services, unnamed RPCs, workers, triggers, Edge code outside this tree, and deployed artifacts are not ruled out. A DBA/CRM owner must still verify current legitimate audit-event producers before any production permission change.

The same applies to `service_role`: the Build187 caller-bound `has_role` proposal preserves its direct EXECUTE grant but intentionally changes requests without an end-user identity to `false`. Direct `supabaseAdmin.from('user_roles')` server checks are not the same function call, but all external or alias-based calls remain unverified.

## Concrete independent reviewer decisions

1. **CRM/security owner:** Verify direct `user_roles` browser/service access, role administration gate, dynamic RPC dispatch, and all 41 production `has_role(auth.uid(), ...)` RLS policy consumers. Confirm whether any legitimate server RPC needs to inspect another user's role, and design a separately privileged path rather than weaken the user-bound helper.
2. **DBA/data owner:** Reconcile the source scan with all actual audit writers, service jobs, database events and external integrations. If approved, test the proposed append-only audit service writer contract and admin-only reader under real hosted Auth with fictional records and full restore/rollback.
3. **Repository owner:** Protect `main`, choose qualified independent reviewers, enable required checks and acknowledge an externally failing release-HOLD job. Do not merge the draft based on CI alone.
4. **Release owner:** Track hosted UAT, PITR/restore, production security remediations, 9 release signoffs, and Category C LD02/LD05 independent owner acceptance. Evidence does not equal acceptance.

## Status

- Scanner CI job: **PASS** on initial Build190 run [#43828385395](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43828385395); substantive prior GoTrue, signed JWT, PG17 tests passed; dedicated main-release-HOLD still fails deliberately.
- Live production audit grants/policy/helper are **unchanged**; no production SQL, hosted staging writes, merges, role/financial activation or external contact.
- Formal programme **26/100**, **12/43** accepted, **31** open. Category C **6/10** with LD02/LD05 open. Any new acceptance requires independent signoff, not merely scanner results.
