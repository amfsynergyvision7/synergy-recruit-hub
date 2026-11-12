# Build 68 — authenticated positive controls for anonymous hosted RLS checks

**DRAFT / NO RELEASE / NO PRODUCTION OR STAGING WRITE**

## What changed, and why it matters

The previous Build66–67 anonymous hosted surface probe could report **0 visible rows** even when a table or view had no synthetic data at all. An empty table is not useful proof of RLS. Build68 now includes the paired `hosted-positive-controls.mjs` runner:

- Requires the **same dedicated nonproduction Supabase host**, existing exact synthetic-fixture acknowledgement, unprivileged `sb_publishable_` or legacy `anon` key, and an approved pinned synthetic admin user UUID.
- Authenticates the invented admin through GoTrue, confirms the JWT is `authenticated`, unexpired and subject-bound, checks GoTrue `/auth/v1/user`, then verifies that account's exact approved/active profile and admin role using narrowly scoped GETs.
- Checks that **each of 16 private surfaces** (three additional sensitive tables plus all thirteen historical public views) returns at least one synthetic row to that authorized admin. Every surface check uses **HEAD, `Prefer: count=exact` and strict `Content-Range` parsing**; it downloads no private source records.
- **Only after all 16 pass**, executes the existing **20 anonymous HEAD probes** for the same host, proving none of the seeded private surfaces expose rows or forbidden branding fields anonymously. Missing/zero-row admin fixtures stop the anonymous comparison; an anonymous leak fails the combined result.
- Returns **provisional case-level evidence, zero formal acceptance**. Only an independently approved, actually pre-seeded nonproduction environment can run it. The command `node security/build68/hosted-positive-controls.mjs` refuses live production by exact host and fails closed if synthetic credentials or checks are unavailable.

This complements, but does **not** count toward, the existing historical 135 signed GoTrue read cases and five separately governed write cases. No browser testing, full 19-table role matrix, production migration, external communication or financial activation is performed by this code.

## 13-view fixture dependency mapping — actual production catalogue metadata

`view-direct-dependencies.readonly.sql` was run as a **SELECT-only, metadata-only** inventory of public `pg_catalog.pg_rewrite` / `pg_depend` links. `view-fixture-dependencies.json` records:

- **13 public views**, **17 direct dependency edges**, **8 distinct immediate base tables**: `billing`, `candidates`, `clients`, `interviews`, `job_openings`, `offers`, `profiles`, `submissions`.
- The **three private additional tables** `candidate_stage_history`, `email_log`, `workflow_rules`, and the **public branding table** `app_settings` bring this to **12 source table types to plan for**, not a guarantee that only 12 fixture rows will suffice.
- Direct dependencies do not capture view filtering logic, RLS, functions, user-role joins or aggregate requirements. A reviewer must inspect the actual source view definitions and confirm **every one of the 16 authenticated positive-control HEAD checks** sees synthetic data.
- This is a **fixture design plan**, not permission to insert data, create accounts or publish records. Never clone real candidate, client, contact or billing records, and never trigger email, finance, automation or external workflows when populating a controlled synthetic lab.

## Evidence and acceptance boundaries

**Live project facts (most recent read-only observation)**: isolated nonproduction project `dhlhlasnaapzckjyvffn` currently has **0 GoTrue users, 0 public CRM tables and 0 public RLS policies**. Production `wusntntcqgtpgokggdzv` still has 67 legacy public RLS policies, 19 anon `TRUNCATE` table grants and 13 non-invoker views. `main` is unprotected; PR #12 has no independent approval. No live hosted positive or negative cases can currently be accepted.

**Formal release status is unchanged:** 0/48 live remediation accepted, 0/140 real signed hosted authorization cases accepted, 0/9 signed release approvals, 0/6 entire AI Command Center workstreams closed. The additional 16+20 probes are new preflight controls, **not 36 additional accepted cases** or a change to the 140-case denominator.

## Release-critical next actions

1. Obtain the **separate, independently reviewed fixture provisioning gate**. Prepare a dedicated synthetic-only nonproduction environment with reviewed 19-table/13-view source schema, all relevant source policies, nine distinct invented GoTrue Auth users, and an approved per-slot UUID map stored only in an approved secrets manager.
2. Seed all twelve identified fixture source-table types as needed, with controlled positive-data coverage for the 16 private surfaces and one synthetic public-branding row. Verify no real data is imported; disable email, finance and other side effects. Reconcile view definitions, role joins and candidate cross-owner policy checks. Human review must verify fixtures are truly synthetic.
3. Only then run the paired 16-positive/20-anonymous HEAD read-only test, the historical 135 signed role/table tests, the five distinct disposable write checks under their separate gate, and all current-production table/view/function/browser cases. Preserve sanitized, source- and commit-pinned evidence, and obtain independent sign-off.
4. Complete production security remediation, financial/legal/retention decisions, genuine disaster recovery/PITR, branch protection and nine release gates before any `main` merge or deployment.

**Conditional forecast, not a guarantee:** 6–10+ substantive builds before secured CRM `main` merge and 16–28+ further builds for full six-workstream Command Center closure. These are approximate engineering iteration counts, not monetary bills or calendar dates.
