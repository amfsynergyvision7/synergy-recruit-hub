# Build 80 — 135-case authorization oracle and actual PostgreSQL 17 RLS rehearsal

**13 November 2026 · AMF Synergy Vision · PR #12 DRAFT / RELEASE HOLD**

**Scope:** Invented synthetic PostgreSQL and JavaScript tests only; read-only live inspection of the **dedicated nonproduction** and production catalogs. **No production/staging SQL writes, no hosted policy installation, no real GoTrue account creation, no credential export, no financial workflow activation and no merge to `main`.**

## 1. What was physically implemented and verified

- `role-read-oracle.mjs` evaluates the full frozen **135 historical read-case expectations**, across the invented 38-row/19-table Build78/79 fixture and nine invented role-status subjects. Pure in-memory oracle result: **135/135 PASS**, never a signed HTTP test.
- `135-case-role-coverage-review.json` independently freezes all nine role slots by the 15 historical table surfaces. No user UUIDs or real addresses in this report. All read counts are source-traceable to `security/build41/signed-http-135-read-matrix.json`.
- `15-surface-135-read-review-only.rollback.sql` proposes exactly **15 `SELECT`-only RLS policies** and **four default-denied application tables**; it has `BEGIN;` + `ROLLBACK;`, and is **not applied or authorized to deploy**. All five historical write cases remain unexecuted. The candidate, job, submission and interview conditions are scoped to the recruiter’s own assigned candidates; finance billing is limited to an approved, active finance user; self-account read is available to pending/inactive users but never adds business access.
- For consistent RLS semantics, the draft adds a restricted helper `amf_rls_guard.current_has_role(public.app_role)` in a **non-API schema**. It derives the subject exclusively from `auth.uid()`, joins trusted `public.profiles` and `public.user_roles`, requires an approved/active profile and **exactly one qualifying role**, uses `SECURITY DEFINER SET search_path=''`, and provides no caller-supplied target ID. Function EXECUTE is revoked from PUBLIC/anon/service_role and granted only to authenticated. **SECURITY DEFINER still requires independent review and signed hosted testing before any deployment**.
- `pg17-135-read-rehearsal.rollback.sql` embeds the identical review policy source into a **brand-new disposable PostgreSQL 17 CI database**. Its invented local roles and minimal 19-table fixtures are created and dropped by **one ROLLBACK**. The script uses an `auth.uid()` SQL simulation to exercise **actual PostgreSQL RLS**, but **not real signed GoTrue tokens**.

### Actual CI evidence on SHA `20000e9da8d4b0849f0930de781c8856ee421867`

| Verified check | Result |
|---|---|
| Fast Node/contract test suite | **189/189 PASS** |
| Disposable PostgreSQL 17 actual RLS read-count checks | **135/135 PASS** |
| Default-denied app tables under authenticated role | **4/4 denied** |
| Anonymous application SELECT checks | **6/6 denied** |
| Recruiter cross-ownership and scoped self-access | **PASS** |
| Direct CRM write-grant checks | **PASS, denied** |
| Disposable test schemas/roles after ROLLBACK | **zero remaining** |
| Full security CI engineering jobs, including source-shaped RLS integration | **33/33 PASS** |
| Production-release-hold CI job | **deliberately FAILED / release remains blocked** |

Original first disposable PG17 attempt failed only because vanilla PostgreSQL did not have Supabase’s `service_role` pseudo-role; the **disposable test setup** was corrected to synthesize it, without changing the review policy or any hosted database. Latest successful complete tests are at the SHA above.

## 2. Role-by-table scope proposed for independent review

All counts below are **expected synthetic rows**, not user/company records and not accepted hosted UAT.

| Role slot | Synthetic role/status | Tables with positive read visibility | Total visible rows across 15 tests |
|---|---|---:|---:|
| 1 | Approved active admin | 15 | 34 |
| 2 | Approved active recruiter A | 7 | 7 |
| 3 | Approved active recruiter B | 7 | 7 |
| 4 | Approved active finance | 3 | 3 |
| 5 | Approved active operations | 2 (self) | 2 |
| 6 | Pending active recruiter | 2 (self) | 2 |
| 7 | Approved inactive recruiter | 2 (self) | 2 |
| 8 | Approved active viewer | 2 (self) | 2 |
| 9 | No profile / no role | 0 | 0 |

The four default-denied `public` tables are `app_settings`, `candidate_stage_history`, `email_log` and `workflow_rules`. This is **not** a final app-compatibility decision; public branding, stage history and controlled internal workflows require separate privacy, business and security policy acceptance. The 13 invoker-security views retain their existing **no anon/authenticated grants** until separately approved. Some application UI functionality will intentionally remain unavailable with this restrictive proposal alone.

## 3. Actual live hosted nonproduction read-only evidence

Executed `security/build80/15-surface-hosted-baseline.readonly.sql` on dedicated project `dhlhlasnaapzckjyvffn`. Readback returned:

```json
{
 "table_scoped_read_surfaces":15,
 "forced_rls_read_surfaces":15,
 "anon_granted_read_surfaces":0,
 "authenticated_granted_read_surfaces":0,
 "authenticated_granted_write_surfaces":0,
 "default_denied_surfaces":4,
 "unsafe_default_denied_surfaces":0,
 "installed_app_policies":0,
 "invoker_unreadable_views":13,
 "total_app_views":13,
 "public_functions":16,
 "callable_app_functions":0,
 "proposed_helper_schemas_installed":0,
 "auth_users":0,
 "live_baseline_gate":"BUILD80_LIVE_15_SURFACE_DENY_BASELINE_PASS_NOT_SIGNED_UAT",
 "actual_135_signed_read_cases_executed":0,
 "accepted_release_cases":0
}
```

After the CI work, a second read-only nonproduction check still found **0 Auth users, 0 profiles/roles/candidates, 0 policies and 0 enabled application triggers**. Neither `amf_rls_guard` nor the 15 SELECT policies exists in the live project. The earlier Build79 live policy rehearsal was **blocked by a safety control** and not bypassed: the actual PostgreSQL replay here ran solely inside a disposable GitHub Actions service container.

## 4. Review gaps, risks and remaining signoffs

1. **Real GoTrue identity setup:** Build78 guarded server-only Auth Admin provisioner requires an authorized isolated server environment and protected nonproduction secret; the connector here cannot run Auth Admin createUser. Nine real UAT identities are **0/9**.
2. **Inert fixture and RBAC installation:** Build78 base 8/8/2 and Build79 remaining 16-table/20-row seed paths are prepared, not executed. The full **38 invented rows** have not been inserted. The 15 read policies are a *review draft*, not approved for hosted deployment; their private SECURITY DEFINER boundary, all 42 source foreign keys, role exclusivity, view behavior and application compatibility require independent assessment.
3. **Hosted signed HTTP/browser UAT:** Run `security/build64/hosted-135-readonly.mjs` only after nine real GoTrue sessions and the exact fixture exist. The 135 historical reads are **0/135 signed hosted executed/accepted**; five separately controlled write cases are likewise **0/5**. Total independently signed acceptance remains **0/140**.
4. **Production and governance:** Actual production read-only baseline still has **67 public legacy policies, 19 anonymous TRUNCATE grants and 13 non-invoker views**. **0/48** production remediations accepted; **0/9** independent release gates signed; **0/6** programme workstreams closed. PR #12 remains DRAFT/unmerged and has **0 independent reviews**. The GitHub `main` branch endpoint reports `protected=false`; no rulesets were returned in the prior ruleset query. Independent security review, branch protection, PITR/restore proof, HR/legal/privacy/finance acceptance and source-pinned production remediation remain mandatory.

**Conditional planning range: approximately 5–10+ substantive CRM-release builds to `main` and 15–30+ for the full AI Command Center.** It would be misleading to shorten the forecast because engineering test passes do not replace the 140 hosted cases or the nine signoffs. If those human/credential dependencies remain unavailable, no fixed build count can guarantee deployment.

**Source and audit paths:** PR #12; hosted UAT issue #13; governance issue #14; fast CI [43370543113](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43370543113); full guarded CI [43370543106](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43370543106). No actual production candidate, client, billing or auth records are included.
