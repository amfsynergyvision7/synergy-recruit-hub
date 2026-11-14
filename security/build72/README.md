# Build 72 — 19-table TRUNCATE privilege and 16-function PUBLIC fallback security replay

**STRICT REVIEW HOLD.** PR #12 is a draft review branch. No staging or production database write, genuine candidate/customer data read, release merge, financial activation, outbound communication or deployment occurred.

## Live, catalog-only evidence

`live-truncate-and-function-acl-snapshot.json` is an actual production `pg_catalog` read-only capture, source-dating 12 November 2026. It confirms **19 public tables**, **all 19 RLS-enabled**, all **19 granting `TRUNCATE` to `anon` and `authenticated`**, and **16 `SECURITY DEFINER` functions** owned by `postgres` with `anon` `EXECUTE` privileges. Of those 16, 13 set `search_path=public`, two have no explicit `search_path` configuration, and one sets `search_path=pg_catalog`. The code merely captures signatures, privileges, settings and MD5 of function definitions, not the function bodies.

A second live `aclexplode` metadata query is preserved in `live-function-public-acl-snapshot.json`. It confirms all 16 functions have a **direct `anon` `EXECUTE` grant**, while **nine additionally grant `EXECUTE` to `PUBLIC`**. Therefore, revoking a function's direct anonymous grant alone leaves those nine privileges effectively available through `PUBLIC`. A release migration must review both grants and separately preserve the necessary authenticated role helper and trigger/scheduler capabilities.

The 13-view owner/ACL/MD5 evidence from Build71 completes a **48-object public release-security source inventory: 19 tables + 13 views + 16 privileged functions**. This does NOT mean any one actual row was accessed or a production vulnerability exploited.

## Genuine disposable PostgreSQL 17 tests

`all-19-anon-truncate-rls-bypass.rollback.sql` replays all **19 exact source-shaped tables** from Build40's production-derived inventory and inserts **one invented, ID-only row per table** in a disposable PostgreSQL 17 CI database. It enables RLS on all 19, verifies the synthetic anonymous role cannot SELECT the billing row under RLS, but can **TRUNCATE all 19 tables** once `TRUNCATE` is granted. It verifies all invented rows were removed, revokes `TRUNCATE`, and checks that all 19 destructive attempts then fail with insufficient privileges. The SQL ends with an unconditional `ROLLBACK`; CI confirms no synthetic tables or roles survive and drops the disposable database. This proves **PostgreSQL privilege semantics**, not that ordinary PostgREST HTTP endpoints directly expose `TRUNCATE`.

`all-16-function-public-fallback.rollback.sql` replays **16 harmless synthetic `SECURITY DEFINER` stubs** matching the known signatures (never executes real production function bodies). It recreates the source-shaped **16 direct-anon and nine `PUBLIC` `EXECUTE` grants**; confirms all 16 are initially callable in privilege terms, then revokes **only direct `anon` privileges** and proves that **nine remain reachable through `PUBLIC`**. After revoking `PUBLIC`, zero remain anonymous-callable. It then models the existing Build40 proposal to preserve only three authenticated role helpers (`get_user_role`, `has_role`, `is_approved`) in the synthetic review. The workflow verifies no residual privileged function or synthetic role after rollback and drops its temporary database.

Both are run inside the existing `expanded-public-security-contracts` CI job, in **two distinct disposable databases**, with `psql -v ON_ERROR_STOP=1` and explicit cleanup verification. `truncate-and-function-contract.test.mjs` and `function-public-fallback-contract.test.mjs` check exact live inventory alignment, source-shaped DDL, signature/grant counts, rollback, no real hosted database hostnames and no irreversible COMMIT. The fast CI runs the source contracts, not the SQL integrations.

## Release decisions still required

1. Independently approve all 19 exact-table `TRUNCATE` revocations for `anon` and `authenticated` after checking whether service-role/maintenance actions depend on those privileges; standard CRM endpoints should not require ordinary users to truncate.
2. Review all 16 privileged function signatures, MD5s, permission grants, public fallback and `search_path` semantics, with special scrutiny of 13 `search_path=public` definitions and the two unset definitions. Decide whether three role helpers should remain available to authenticated callers and how trigger/scheduler functions are invoked. Existing candidate security releases remain draft and guarded.
3. Reconcile 13 `postgres`-owned, anon-readable non-invoker views (Build71) with the final 19 table/16 function ACL review and protect `main` only after CI, owner review and independent release signatures.
4. Provision the separately authorized, synthetic-only 19-table/13-view hosted UAT lab with nine invented Auth users and eight profile/role records after independently reviewing 32 trigger side effects. Run genuine historical 140-case and current-schema hosted/browser/view/function acceptance, not mock-only tests.
5. Finish production-equivalent encrypted backup/PITR/recovery, finance/legal/retention decisions, independent code review, and nine formal release approval gates before any production write, merge or deployment.

**Current formal acceptance stays unchanged:** 0/48 independently accepted live production remediations, 0/140 real hosted authorization cases, 0/9 signed security gates and 0/6 whole-program workstream sign-offs. The dedicated hosted nonproduction Supabase project remains empty on its most recent read-only check.

**Conditional estimate:** around **6–10+** further substantial engineering builds for secured CRM `main` merge and **16–28+** for the complete six-workstream AI Command Center (including CRM), dependent on external fixture/recovery/approval gates. These are build iteration estimates, not currency bills, deadlines or a reliable overall completion percentage.
