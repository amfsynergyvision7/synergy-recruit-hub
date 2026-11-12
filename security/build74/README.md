# Build 74 — real combined release postflight reconciliation (STRICT DRAFT / RELEASE HOLD)

**Scope:** A genuine engineering integration fix, not a production migration or a release authorization. `main` remains unchanged. No staging/production SQL write, hosted user provisioning, candidate/client data read, financial activation, external communication or deployment.

## Root cause discovered and corrected

The Build73 `48-object-release-preflight.readonly.sql` is correct **for the existing live production baseline**: there are **19 public tables, 13 public views and 16 existing public `SECURITY DEFINER` functions**. Its permission PASS contract allows three authenticated RLS helpers.

But the existing protected combined Build54/55/56/57/58/59 release candidate creates **six additional authenticated-only `SECURITY DEFINER` CRM RPCs**:

| New approved RPC | Purpose |
|---|---|
| `crm_admin_manage_user(uuid,text,text)` | Role / account changes |
| `crm_update_own_profile(text,text,text)` | Restricted own-profile edit |
| `crm_change_candidate_stage(uuid,text,text)` | Governed stage changes |
| `crm_write_candidate(uuid,timestamptz,jsonb)` | Governed candidate create/update |
| `crm_import_candidates_atomic(uuid,uuid,jsonb)` | Idempotent candidate import |
| `crm_candidate_delete_impact(uuid)` | Read-only deletion impact counts |

A direct use of the old 16-function / three-auth-helper gate as the **post-release** verifier would incorrectly fail an otherwise source-correct 22-function migration. Build74 keeps the existing live **16-function current-state gate unmodified**, and derives a separate **22-function / nine-authenticated-RPC postflight** from its source-pinned 19/13/16 catalog query.

## Actual rollback-only combined migration verification

`compose-postrelease-permission-check.mjs` reads the existing deterministic, nine-fragment Build54 source-composed rehearsal from `/tmp/build54-release-review/full-release-rollback.integration.sql`, refuses any missing source guard, verifies every additional CRM function declaration is `SECURITY DEFINER` and granted only to authenticated callers, and appends a new postflight **immediately before the existing one and only `ROLLBACK`**. It writes ONLY to a distinct `/tmp` build74 artifact; it does **not** alter the protected Build54 release source or create deployable production SQL.

The postflight runs against real PostgreSQL in the disposable GitHub Actions service, after the *actual composed* 67→35 policy and candidate/finance/view/function review fragments have been installed **within the open transaction**. It verifies:

- 19 expected RLS-enabled public tables, zero anonymous/authenticated `TRUNCATE`.
- 13 current-source public views with `security_invoker=true`, zero anonymous read grants.
- **Exactly 22 expected public privileged functions**, not merely at least 22; no unexpected extra `SECURITY DEFINER` functions.
- Zero anonymous and `PUBLIC` privileged-function executions.
- **Exactly nine authenticated-allowed functions**: three legacy RLS helpers plus the six named and source-verified CRM RPCs.
- Exactly **35 public RLS policies**, the previously reviewed replacement set.
- An explicit `PERMISSIONS_POSTFLIGHT_PASS_NOT_A_RELEASE_APPROVAL` result. This permission-only check is not the complete policy authorization suite; the existing combined cases are still run independently in the same fixture.

The tool requires a transaction-local synthetic-only marker. Exactly one original BEGIN, one ROLLBACK and zero COMMIT are contract-tested. On CI success the entire transaction rolls back; a separate database query verifies no source-shaped objects persist. The genuine production database was **not** touched.

## Two additional fail-closed rehearsal tests

`compose-negative-release-replays.mjs` intentionally injects **two forbidden grants** into separate copies of the same source-composed rollback SQL: (a) anonymous `EXECUTE` on `crm_import_candidates_atomic`, and (b) anonymous `TRUNCATE` on `public.candidates`. In the full guarded CI workflow, each disposable PostgreSQL rehearsal **must fail with the exact Build74 postflight refusal**, not an unrelated error, and CI checks the database is still empty afterward. These tests are not malicious real-world activity and use no real customer data.

The two Node test files `combined-postflight.test.mjs` and `negative-release-replay.test.mjs` enforce source allowlists, mutation resistance, signature counts and rollback invariants. Neither runs hosted API requests.

## Live source drift check

The actual production `pg_catalog` source digests were freshly read as SELECT-only data on 12 November 2026 and independently compared to the protected existing draft sources:

- 67 RLS policies: `a70190f31ed8436b2989082898a02b51` — exact Build49 match.
- 13 public view definitions: `a90d4a1fab9552d47697127888e10d19` — exact Build59 match.
- Four legacy function definitions: `ea5005b2208a2d0891e3f8004fd7de80` — exact Build58 match, with four missing explicit search paths and two of four functions marked SECURITY DEFINER.

These results, **not** production business data, are captured in `live-release-source-fingerprints.json` and automatically checked against the unchanged protected SQL files in `live-release-source-fingerprints.test.mjs`.

This removes a source-drift uncertainty at the observation point, but must be rerun before any separate independently authorized migration.

## Remaining release barriers

The dedicated synthetic hosted Supabase project has no real GoTrue accounts or CRM schema. Formal acceptance remains **0/48 approved live production remediations, 0/140 independently accepted genuine hosted cases, 0/9 signed security release gates, 0/6 completed whole-program workstreams**. Independent PR review, protected `main`, approved 19-table/13-view/32-trigger synthetic test lab, current-schema function/view/browser acceptance, finance/legal/candidate-retention policy decisions and production-equivalent backup/restore/PITR remain essential.

**Engineering build forecast:** the prior 6–10+ secured CRM and 16–28+ full programme ranges remain conditional, and may be narrowed by at most one iteration after the combined positive/negative postflight passes; formal gates have not closed. A build count is not a guarantee, release date, or monetary bill.
