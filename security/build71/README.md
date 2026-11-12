# Build 71 — all 13 exact live public views: anonymous exposure, invoker and RLS containment

**RELEASE HOLD / DRAFT PR #12.** This build adds review-only security evidence and disposable PostgreSQL testing. It does not update hosted production/staging SQL, configure branch protection, activate financial workflows, seed hosted synthetic users, or merge code into `main`.

## What was actually verified

- `all-13-live-view-sources.json` contains all **13 live public view definitions** retrieved using read-only `pg_get_viewdef` from the existing production Supabase project, with **13 PostgreSQL MD5 source fingerprints**. The saved source is used for the disposable PostgreSQL test; no customer, candidate, finance or employee rows were queried. The test independently verifies the exact SQL text and source hashes.
- `live-public-view-acl-snapshot.json` is a source-matched **read-only catalog permissions snapshot** showing **13/13 views grant SELECT to `anon` and 13/13 are not `security_invoker=true`**. A subsequent read-only ownership check also found **all 13 views owned by `postgres`** (source-pinned in the same evidence manifest). Actual row disclosure was **not** tested in production, and no user/candidate records were downloaded.
- `all-13-view-anonymous-exposure.rollback.sql` builds eight minimal source-shaped tables and 13 **actual live view definitions** in a **throwaway GitHub Actions PostgreSQL 17 database**, inserting one invented row per necessary source and one fake recruiter/candidate. With RLS on underlying tables and anon SELECT on the 13 definer views, it requires the simulated `b71_anon` role to observe **one synthetic row via each of the 13 views**. The test demonstrates the SQL-level risk of owner-rights views **only against invented data**; it cannot prove any specific actual production data disclosure.
- It then tests **three independent containment layers**, each inside the same transaction: (1) `security_invoker=true` prevents anon querying all 13 views without base-table grants; (2) even if anon receives a base `billing` SELECT grant, underlying RLS without an anonymous policy returns **zero invented billing rows**; (3) REVOKE view SELECT from anon denies access to all 13 views again. All assertions are real PostgreSQL semantics, not mock transport responses.
- The test begins `BEGIN`, ends with **unconditional `ROLLBACK`**, and the CI job independently checks that zero public views and no synthetic `b71_anon` role remain before dropping the temporary database. No external PostgreSQL service or hosted project is modified.
- `anonymous-view-replay-contract.test.mjs` enforces the 13 source definitions, source MD5s, eight exact source-table DDLs, the three containment layers and the final rollback, plus the actual 13-view catalog permissions snapshot.
- The integration was added to the **existing** `expanded-public-security-contracts` job in the full guarded CI workflow, and the companion fast workflow exercises the source contracts. The intentional `production-release-hold` job remains unchanged and failing by design. Only the actual CI results for the final Build71 SHA count as engineering verification.

## Why this is important for the release

The live production catalog has **13 anonymous-readable, non-invoker views**. PostgreSQL definer-mode views can execute with owner privileges rather than the caller's underlying table restrictions. Build71 provides a source-exact synthetic exposure/containment test for **every** current public view. A reviewer must examine actual ACLs, view dependencies, RLS policies, functions, candidate/billing confidentiality, customer expectations, admin-browser compatibility and the rollback plan before production changes.

The earlier Build70 five-recruiter-view role-filter proposal is still **not activated**. Build59's 13-view production source fingerprints remain unchanged and must be reconciled in a separately reviewed migration. The new source catalog is evidence, not permission to release the draft SQL.

## Still blocked

- Dedicated hosted synthetic nonproduction Supabase still has **zero Auth users, zero public CRM tables and zero public views** on its latest read-only audit. Genuine hosted GoTrue/browser/API tests remain **0/140 formally accepted**. The 16 seeded-positive and 20 anonymous-negative probes likewise have not been executed with approved hosted synthetic fixtures.
- Production remains at **67 legacy RLS policies, 19 anon `TRUNCATE` table grants, 13 non-invoker views**; accepted live production remediations remain **0/48**.
- Formal security gates **0/9**, whole-program workstreams **0/6**, independent PR reviews **0**, protected main **not enabled**, production-equivalent encrypted recovery/PITR and finance/legal/retention acceptance **not completed**.
- No staging/production SQL writes, customer/candidate data downloads, financial automation activation, external communication, PR merge or deployment was performed.

**Conditional forecast:** approximately **6–10+ substantive engineering builds to a secured CRM merge into `main`** and **16–28+ more to complete the entire six-workstream AI Command Center, CRM included**. These are indicative build iterations, not money, deadlines or a verified overall completion percentage.

## Real hosted path forward

1. Independently review and approve a synthetic-only, isolated, 19-table/13-view/32-trigger fixture lab, with nine invented Auth accounts, eight corresponding profiles/roles, one unprofiled negative case, and safe email/finance/sync isolation.
2. Actually execute original 135 signed read cases, five separately approved disposable write cases, 16 seeded positive HEAD controls and 20 anonymous HEAD controls, plus current view/function/role/browser acceptance; preserve source- and commit-pinned sanitized evidence.
3. Independently approve finance, retention, recruiter directory semantics, production-equivalent backup/PITR recovery, all 48 remediation outcomes, protected `main`, independent reviews and all nine release signatures. Only then consider production merge/deployment.
