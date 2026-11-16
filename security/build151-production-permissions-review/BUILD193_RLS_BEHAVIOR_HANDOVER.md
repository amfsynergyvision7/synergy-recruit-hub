# Build 193 — Real drafted 35-policy RLS behavior on fictional users and records

**16 November 2026 · DRAFT / DISPOSABLE ONLY / NOT ACCEPTED OR DEPLOYED**

## The new substantive evidence

Build192 compiled and rehearsed the source-pinned 67→35-policy/48-object SQL, but its original 16 privileged-function fixture bodies were deliberately inert and it tested **no real row decisions**. Build193 closes part of that testing gap by executing actual database SELECT, INSERT and UPDATE statements through the **existing, completely unchanged 35-policy proposal** on PostgreSQL 17 with realistic fictional role assignments and rows.

- [New SQL behavioral scenarios](./build193-rls-authorization.disposable.pg17.sql) are included **inside** the original [Build192 source-hash-pinned replay](./build192-replay-actual-proposal.disposable.mjs), after the dual metadata+exact-predicate checks and before its unconditional ROLLBACK.
- The fixture replaces **only within the never-committed PostgreSQL transaction** the earlier inert test versions of `auth.uid()`, `public.has_role` and `public.is_approved` with simple, clear role-lookup/active-profile test functions. **These are NOT claims about real production function bodies or signatures beyond the already-reviewed function names.**
- Five fictional identities: approved admin, two approved recruiters with separate candidate assignments, approved finance user, and a pending user with an admin role but no active/approved status. All records, job IDs, invoices, audit entries and notifications are manufactured for the test.
- This is **not actual GoTrue issuance** or a signed HTTP request: PostgreSQL's authenticated role is selected via `SET LOCAL ROLE`, and the fictional identity is set by a test-only session GUC. The production RLS predicates themselves remain **exactly as authored** in the unchanged 35-policy draft.

## Verified behavioral coverage

| Fictional actor / action | Observed PG17 behavior |
|---|---|
| Anonymous `anon` database role | No direct SELECT/INSERT of private CRM or audit tables |
| Approved admin | Sees two candidate/job records, sample billing/audit, all five fictional account roles/profiles, and related candidate/client records |
| Approved recruiter A | Sees only assigned candidate/job, own notification and role; cannot read billing, audit, clients or other recruiter data |
| Approved recruiter B | Sees its own candidate/job and related sample rows, not recruiter A's |
| Recruiter A candidate INSERT | Allowed when assigned to self; rejected when assigned to recruiter B |
| Recruiter A candidate stage UPDATE | Allowed on permitted `stage` column; changing `assigned_recruiter` denied by column privilege |
| Recruiter A notification UPDATE | Can mark own notification `is_read`; cannot change recipient |
| Recruiter A related submissions/interviews/stage history | Sees only linked assigned-candidate rows; an unauthorized new submission is rejected |
| Finance | Reads billing but cannot read candidates, jobs, audit or recruiter-specific related records |
| Pending but admin-role account | Cannot read candidate/job/billing/audit data despite the `admin` role; self profile and role remain readable |
| Authenticated database role without identity `sub` | Cannot read candidate/job/billing/audit data |

The actual SQL of the proposed 35 policies was compiled and exercised. All those tests passed in the verified CI run. No attempted user-data extraction, production RLS query or connected database mutation took place.

## Important limitations

1. **The helper bodies are test stand-ins, not the production `has_role`/`is_approved` bodies.** The separate Build187/189 standalone GoTrue/role-helper tests are not automatically proof of the **combined** 35-policy/production helper integration.
2. Five fictional identities and a small row sample do not cover every branch of all 35 policies or all 19 tables, non-public schemas, schema exposure, triggers, external jobs, service-role writes, financial effects or active CRM code.
3. The synthetic `auth.uid()` uses a fake session variable, **not a cryptographically verified or hosted GoTrue-issued JWT**. This is PostgreSQL policy-behavior rehearsal only; the earlier Build189 GoTrue tests covered another isolated fixture, not this 35-policy integration.
4. The policies' code itself remains an **unapproved draft of business authorization rules**. Tests of proposed rules cannot approve them as legitimate company policy or validate contractual/financial restrictions.
5. All new and legacy proposed RPCs, grants, SQL migrations and the old **67 policies** reverted under the **outer rollback**; no hosted project or `main` files were modified.

## Evidence and next gates

[Build193 exact-head CI run #43843884887](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43843884887): **30/30** source tests passed, **25/25** intentionally adverse PG17 catalogue checks returned HOLD and rolled back, and the full actual 67→35 proposal SQL passed both metadata/policy fingerprints plus the new row/permission behavior assertions, ending with original **67-policy fingerprint restored** and both proposed admin RPCs absent. Three CI jobs succeeded.

A qualified DBA/security and CRM owner must independently review the full 35-policy authorization matrix, caller-owned assignment and update semantics, triggers, profile approval logic, service writers, integration dependencies and the new behavior tests. Real **hosted fictional-record GoTrue-issued JWT** UAT, complete **140-case** acceptance, approved backup/PITR restore, genuine independent PR reviews, protected `main` and nine go-live signoffs remain mandatory.

Related existing draft reviews: [PR #16](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16) full permissions, [PR #23](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/23) role helper/audit, [PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) outbox integrity.

**Official acceptance unchanged:** programme **26/100 (26%)**, **12/43** accepted, **31 open**; Category C **6/10** (LD02/LD05 awaiting independent acceptance), security live remediation **0/48**, hosted signed UAT **0/140**, release signatures **0/9**. **HOLD: no merge, production deployment or hosted data writes.**

## Build193 additional production security-advisor readback (no database changes)

The latest **read-only** Supabase production security-advisor results (16 Nov 2026) separately report **13 security-definer views** (ERROR), **16 anonymous-callable SECURITY DEFINER functions** (WARN), **4 routines with mutable search paths** (WARN), **one RLS table without a policy** (INFO), an extension in the public schema (WARN), and a leaked-password-protection configuration recommendation (WARN). These are advisory findings, not confirmed incidents or proof of external abuse. [View-security guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) and [routine-search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

A source/production-catalog comparison found the original 48-object review addresses the two privileged trigger routines with mutable search paths, but **two additional SECURITY INVOKER helper routines** also lack fixed search-path settings. They are outside the legacy 16-function baseline and require **separate qualified review**, including impact analysis before any search-path alteration. This finding must not be silently treated as remediated by the unchanged 48-object proposal. No new routine SQL or host privileges were applied.

The advisory findings reinforce the existing urgent security-owner HOLD; this document contains no live credentials, business rows, data-access proof or exploit procedure.
