# Build 136 — An independently actionable lab-function parity gap and duplicate-review error redaction

**Status:** Draft PR #12, no merge/deploy, no staging or production database writes, no Auth provisioning, no financial activation or external messaging.

## Verified starting point: Build 135

- PR #12 head `1906b1e46bf34855f4b06e7cdba5d1d2cd744f88` had exact-head fast CI [43588644293](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43588644293) **848/848 passing tests** (837 offline + 11 standalone candidate/finance), plus application compilation and TypeScript success.
- Exact-head guarded CI [43588644274](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43588644274) passed **36 of 37** jobs, the sole failure being intentional `production-release-hold`.
- `main` at `c735292fbace6605d691a68b602a02b2c6f9e137` was unprotected, rulesets `[]`, independent submitted reviews on PR #12 and #15 **0**. No protected merge or production release.

## A. Actual Build 136 source change

`src/routes/_app.duplicates.tsx` previously interpolated `query.error.message` into the approved administrator UI after a failed candidate-contact duplicate scan. Such a backend error could contain SQL fragments, internal diagnostics, record identifiers, URLs or personal details. The UI now displays a fixed, nonrevealing failure message and no partial candidate clusters, preserving exact approved-admin entry gating, signed server reauthorization, two-pass complete scanning and unconditional candidate deletion/stage holds.

New `security/build136/duplicate-review-error-safety.test.mjs` checks role gating, error redaction, no candidate write paths, account-keyed private cache, safe export manifest gating and two-pass count reconciliation. This is privacy defense in depth, **not** a substitute for hosted backend RLS or an accepted privacy review.

## B. Real isolated lab object and privilege inventory (READ ONLY)

**Source:** Supabase metadata `pg_catalog.pg_class`, `pg_proc`, `pg_policies`, `pg_trigger`, role privilege checks and `auth.users` **count only**, project `dhlhlasnaapzckjyvffn`, observed November 14, 2026. No function bodies, real business rows, customer records, secrets, SQL DDL/DML or live external actions accessed.

| Item | Isolated lab observed | Historical production inventory | Status |
|---|---:|---:|---|
| Public tables | 19 | 19 | Same object names; 19/19 RLS enabled and **forced** |
| Public views | 13 | 13 | Same names; 13/13 `security_invoker=true` |
| Security-definer public functions | **7** | **16** | **9 functions absent from this lab** |
| Public RLS policies | **0** | Historical review describes broader intended policies | No hosted signed-user role authorization possible yet |
| Auth users | **0** | Not compared to production | No approved fictional accounts provisioned |
| Enabled public application triggers | **0** | Not compared to production | No server trigger-effect UAT |
| `anon`/`authenticated` SELECT grants on public tables/views | **0** | No current production recheck | Data API readback requires reviewed grants + policies |
| `anon`/`authenticated` EXECUTE grants on lab security-definer functions | **0** | Historical snapshot shows broad grants | Current lab denies; verify target separately |
| Actual public table rows | 0 in each of 19 tables | Not inspected | No fixture test data yet |

The historical reference is `security/build47/catalog-inventory.json` (November 11, 2026). The **nine historical function names not present in the isolated lab** are:

1. `generate_reminders`
2. `get_user_role`
3. `handle_new_user`
4. `has_role`
5. `is_approved`
6. `resolve_candidate_uuid`
7. `resolve_client_uuid`
8. `resolve_job_uuid`
9. `rls_auto_enable`

These include role/approval helpers and foreign-key/legacy-alias resolution. Their absence **in this lab** means that blindly attempting the hosted role test matrix will fail or test an incomplete authorization implementation. It is **not evidence these functions are missing from live production on November 14**. The reference is historical and should be independently refreshed from actual production metadata by an authorized security owner.

The exact named-object metadata and zero-grant counters are pinned in `security/build136/read-only-lab-object-evidence.json`, cross-checked against the historical source in `security/build136/lab-object-reconciliation.test.mjs`. A reproducible **SELECT-only, metadata-only** query is in `security/build136/lab-readonly-reconciliation.sql` for the authorized lab owner. Do **not** execute it against production without a separate production read authorization.

## C. Reviewer handoff for the nine-function lab gap

**Repository administrator / independent reviewer:** protect `main` (independently approved PR review, verified substantive CI check such as `substantive-security-summary`, no bypass/force push); independently review exact-head nonproduction Auth [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15); configure `amf-nonprod-auth-review` with a distinct approval owner and nonproduction-only secrets. The current GitHub tool set does not allow the author to configure repository protection or invent an independent reviewer.

**Database/security owner:** independently reconcile the nine historical functions against the lab and a separately authorized, current production metadata read. Approve an explicit least-privilege script plan for only those functions actually required in the isolated test environment, with precise `auth.uid()` validation, safe search paths and no public/anonymous EXECUTE privileges. Review the trigger references and full 19-table/13-view grants. **No function creation or policy/credential writes are authorized by this evidence file.** No automatic function migration is prepared or applied.

**Lab/UAT operator, after independent approval:** run a read-only `AUDIT_ONLY` proof, then independently authorized fictional 9-Auth/38-inert-row setup; collect 140 signed role/API cases and exact RLS, column-grant, trigger and rollback evidence. Do not copy real candidates, CRM contacts or production secrets.

**Security and release owners:** accept the 48 actual production object remediations, backups/PITR/rollback evidence, financial safety and nine formal signoffs before a protected merge or actual deployment. Vercel build-rate-limit is a separate external CI/deployment blocker.

## D. Numeric acceptance

The fixed, evidence-weighted programme rubric remains **26/100**, **12 of 43 milestones independently evidenced**, **31 open**, **74 points unearned**. Protected-merge readiness remains **0/8**; hosted signed UAT **0/140**, approved 48-object production security remediation **0/48**, real fictional Auth **0/9**, inert records **0/38**, release signoffs **0/9**. This build improves *reviewer evidence quality* but **does not independently close a release gate**.

**Approximate milestone-closing builds:** 16–31 if 1–2 independently accepted milestones close in each build (optimistic ~11 at 3 each). With current zero independent gate closure rate and unavailable administration/reviewer prerequisites, **no finite countdown is defensible**.

**CI acceptance:** Only final exact-head Build136 results count. Require application build+TypeScript, full offline tests, standalone candidate/finance holds, and all substantive guarded checks passing. The deliberate `production-release-hold` stays failed. No claims of production readiness are made by this document.
