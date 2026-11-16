# Build 67 — privacy-minimizing hosted UAT and fixture-identity readiness

**Review-only.** All work is on draft PR #12. No staging or production SQL mutations, hosted synthetic identity provisioning, real candidate-record reads, merge, deployment or financial activation. The separate production release hold remains enforced.

## Meaningful engineering improvements

1. **Anonymous extra-scope preflight now uses only HTTP HEAD** with `Prefer: count=exact` and checks exact `Content-Range` metadata for 20 proposed cases: 3 omitted private tables, 13 public views, 3 private `app_settings` projections, and 1 public-branding projection. No response body is ever read. Permission denial must be 401/403; a 404, 5xx or missing/unparseable row count never passes. Public branding must count exactly one approved synthetic fixture row. The private fields require explicit denial even when the row count is zero.
2. **Historical 135-case signed GoTrue read suite is substantially data-minimized:** 132 normal table/role checks use HTTP HEAD exact counts without downloading business rows. The 3 inventoried synthetic candidate-ownership cases use GET of `id` only and compare the precise owned synthetic UUIDs; the 18 synthetic own-profile / role fixture checks and 9 GoTrue `/user` confirmations are separate necessary identity verification steps. All API paths, methods, origins and redirects are constrained.
3. **Secure nine-slot fixture map:** all nine GoTrue users must match nine separately approved, distinct, explicitly provided hosted fixture UUIDs. Readiness configuration requires `AMF_UAT_CASE_01_EXPECTED_UUID` through `AMF_UAT_CASE_09_EXPECTED_UUID`, alongside existing `_EMAIL` and `_PASSWORD`, held only in an approved secrets manager. This allows GoTrue-created user IDs to differ from the **immutable historical source-matrix UUIDs** while preventing an unrelated account from silently passing a slot. The historical 135-case ID ordering and exact expected row-count sequence remain pinned. Never write credential or fixture-mapping values into GitHub, ChatGPT or evidence logs.
4. **Test guardrails:** synthetic adversarial tests exercise wrong hosted subject, missing or duplicated UUID mapping, manipulated RLS row counts, absent/malformed `Content-Range`, cross-recruiter candidate ownership, JWT role/subject/expiration and network fail-closed behavior. `data-minimization-contract.test.mjs` checks HEAD-only anonymous reads and the narrow 3-GET candidate allowance as a source contract.
5. **Lower CI waste:** both workflow files use branch/event/individual-workflow scoped `concurrency.cancel-in-progress: true`, cancelling obsolete runs from repeated bulk source writes while keeping pull-request release-hold validation separate from push runs. All 32 substantive checks, the 32-job aggregate, and the intentional production-release hold remain present. New Build67 paths are included in fast and full workflows.

## Distinguish source-shaped 15-table historical tests from current production

The historical matrix covers **135 read checks across 15 tables**, plus **five separately governed write cases**. It does not include four current production public tables (`app_settings`, `candidate_stage_history`, `email_log`, `workflow_rules`), thirteen public views, and newly discovered view, function and grant risks. Build66 added 20 **additional provisional** anonymous-visibility probes; these must **not** be counted toward the original 140 formal acceptance cases or called an expansion of that denominator without independently approved test-plan revisions.

A preflight HEAD count can establish that no rows are visible in a precisely configured synthetic test fixture. It does not establish all role/access combinations, financial safety, browser UI acceptance, absence of privilege-escalation through functions, or safety of a live migration. Case-level human review is still required.

## Confirmed readiness blockers from latest catalog readbacks

- Dedicated nonproduction `dhlhlasnaapzckjyvffn` has **zero** actual hosted Auth users, **zero** public CRM tables and **zero** public RLS policies, so these tools have **not** been run against real hosted fixture users. Do not falsely mark `0/140` as progressed.
- Production `wusntntcqgtpgokggdzv` currently has **67** legacy public RLS policies, **19** anonymous `TRUNCATE` table grants, and **13** non-invoker views. Exact four extra tables have anon SELECT/TRUNCATE; `candidate_stage_history` has RLS enabled but no policy. All results are **catalog-only**, not business-row reads.
- `main` remains at `c735292fbace6605d691a68b602a02b2c6f9e137`, unprotected as last verified; PR #12 has no independent approval.

## Next independent release gates

- Prepare source-verified, isolated synthetic-only 19-table/13-view hosted schema plus nine real synthetic GoTrue users using a **separate approved fixture-provisioning and data-access gate**; create an attested external slot-to-UUID map and preseed two differently assigned invented candidate rows. No real company/user/candidate/customer/finance data cloned.
- Execute 135 real hosted historical GET/HEAD checks and the distinct 20 extra-scope HEAD checks. Conduct five historical write cases only inside a separately approved disposable test fixture; independently evaluate missing current schema/views/functions, all 140 original cases and browser/API workflows.
- Obtain legal/finance/candidate-retention decisions, production-equivalent encrypted backup and PITR/restore verification, independent code and security reviews, branch protection and nine signed release approvals before any merge or deployment.

**Formal closure remains:** 0/48 production remediations; 0/140 independently accepted hosted cases; 0/9 security gate signatures; 0/6 whole-program workstream sign-offs. The safe working estimate stays **6–10+ further substantive builds to secure CRM merge** and **16–28+ further builds including CRM to complete all six AI Command Center workstreams**, conditional on external provision/decisions. These are engineering iteration estimates, not bills or deadlines.
