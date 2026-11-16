# Build 200 — Private service lookup alternative: disposable security compatibility evidence

**16 November 2026 · PR #16 DRAFT · NOT an approved migration · NO hosted database writes, merges, deployment, contact or financial activation.**

## Issue under review

Build199 combined the three **unapproved** draft security candidates for the original public `has_role`, `get_user_role`, `is_approved` functions and the role-revocation notification policies. It proved these proposals work together for fictional browser callers. It also showed that an existing `service_role` with no authenticated user subject receives NULL/FALSE from all three caller-bound helpers. This could break legitimate server/admin jobs that need cross-user lookups.

Build200 tests a possible **separate back-end-only read interface**, rather than re-enabling cross-user lookups in browser-reachable `public` RPC functions.

### Source-verified facts, SELECT-only production catalogue inspection

- Connected production role metadata shows `service_role.rolbypassrls=true`; `authenticated` and `anon` have `rolbypassrls=false`.
- Connected production `service_role` has SELECT privileges on `public.user_roles` and `public.profiles`. These privileges already exist; Build200 does not grant or alter any production privilege.
- The live production PostgreSQL catalog contains no other **function bodies with direct literal references** to `get_user_role(...)`, `is_approved(...)`, or `has_role(...)` among scanned `public`/private stored routines. This does **not** rule out dynamic SQL, migration-defined policies, triggers, downstream service code, external apps or actual API traffic.
- Existing production still has **67** public RLS policies, including **15** unrestricted PUBLIC ALL policies; the three legacy privileged lookup helpers are anonymously executable. No server-only alternative has been created in production.

These observations establish a **feasibility precondition**, not a qualified authorization or privacy decision.

## Exact review-only design

[Build200 private service SQL candidate](./build200-internal-service-lookup.REVIEW-ONLY.sql.txt), Git blob `56fd30f7531b1303ef8f2ce26e3ec54471eb0403`, creates only inside the throwaway CI database:

- A distinct `b200_review_internal` schema, NOT listed in PostgREST's `PGRST_DB_SCHEMAS=public`.
- `SECURITY INVOKER` functions `staff_role(uuid)` and `staff_approved(uuid)`. They return only a role enum and approved-active Boolean, not full personal records.
- Explicit REVOKE on schema and function access for PUBLIC, `anon` and `authenticated`, plus schema USAGE and function EXECUTE only to `service_role`.
- An empty search path and schema-qualified tables; the caller's existing table SELECT permissions are required.
- A strict `current_database()='amf_build195_gotrue_35_policy_lab'` and `session_user='postgres'` installation guard. **This SQL is NOT a production migration.**

**Important security qualification:** Because Supabase's existing `service_role` is a `BYPASSRLS` role, this function is a narrow *interface*, NOT a least-privileged role sandbox or a limit on everything the service credential can read. Protecting and auditing the service key, preventing browser exposure, and authorizing particular backend workflows remain mandatory. No audited production backend route was built or approved.

## Realistic fixture correction discovered

The immutable historical disposable GoTrue base schema creates `service_role NOLOGIN` but omits Supabase's production `BYPASSRLS` attribute. An initial build run installed the private invoker functions successfully but could not read fictional role rows through the RLS-protected table. An independent **SELECT-only production role-catalog** check verified `rolbypassrls=true` in the actual service role.

The [Build200 disposable test](./build200-private-service-alternative.disposable.mjs), Git blob `90ea1c71567491ec5b93ab5155160d97abba76d0`, now:
1. Asserts that the *original disposable fixture* is missing BYPASSRLS, to prevent silent model drift.
2. Performs `ALTER ROLE service_role BYPASSRLS` **only inside the GitHub-hosted temporary PostgreSQL 17 service**, not any hosted company project.
3. Verifies BYPASSRLS is active before running the service-only invoker tests.
4. Verifies all fictional database and role test resources are destroyed when the CI job ends.

This discrepancy is recorded explicitly; the original GoTrue auth schema Git blob and exact source-pinned 35 RLS policies remain unchanged.

## Actual verified behavior

[**Build200 CI #43919257381**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43919257381) — **four substantive jobs PASS**:

| Job / gate | Result |
| --- | --- |
| Source contracts, plus named runtime caller scanner | **41/41** PASS (40 previous + 1 new) |
| 25 adverse PG17 permission and RLS cases | **25/25** expected HOLD and rollback |
| Original source-exact 67→35 draft migration rehearsal, restoration | **PASS**, original 67-policy catalogue restored |
| Real locally GoTrue-issued JWT/PostgREST + combined RLS/helper/service tests | **176/176** PASS (145 previous + 31 Build200 cases) |
| Dedicated committed CI database removal | **Verified absent after cleanup** |

The new checks include service role reading each fictional admin/recruiter/finance/pending account's role and approval state, NULL target handling, source-declared `SECURITY INVOKER`, schema/function privileges, failed direct SQL from ordinary `anon`/`authenticated`, no PostgREST access to the private function from anonymous/admin/recruiter JWTs, unchanged ordinary browser RLS and unchanged exact 35-policy count.

**Build199's source and function fingerprint HOLDs remain in place**: the original PR16 and PR23 proposal SQL files were not edited, and the three unapproved candidate changes must not be smuggled into a release on the strength of these tests.

## Non-negotiable unresolved owner decisions

1. Identify which **real** CRM services, scheduled tasks, imports, admin actions, triggers and Edge jobs need cross-user staff authorization; the 157-file literal source inventory is **not** complete external/deployed/dynamic caller coverage.
2. Decide whether an internal app service must ever use `service_role` / BYPASSRLS at all, or a better **dedicated tightly scoped service DB role** and explicit RLS policy design is appropriate. Do not copy service-role credentials into a frontend or browser runtime.
3. Require **authenticated service identity, authorization of each administrative action, audit logging, rate limiting, key custody, rotation and least-privilege runtime configuration**. None was implemented by the read-only private SQL helper.
4. Independent qualified Security, Privacy, DBA and CRM review of the full policy matrices, qualified backend code paths, function owners, `SECURITY INVOKER` design, existing grants, special service privileges, audit-record integrity and trusted email/outbox writers.
5. Authorize a **new consolidated reviewed migration** if a solution is accepted, coordinate with draft PRs #16/#23/#18 and notification issue #28; source-fingerprint signatures and exact 35-policy predicate gates must continue to block unapproved replacements.
6. Separately authorized **hosted fictional-record UAT (140 cases), backup/PITR restore, protected `main`, independent PR approval and nine final release-owner signatures** are still missing.

## Formal status and release limit

Programme **26/100 (26%)**, **12/43** independently accepted milestones, **31** open. Category C **6/10 (60%)**; LD02 and LD05 remain unaccepted. Live production security remediations **0/48**, hosted UAT **0/140**, final go-live signoffs **0/9**.

**RELEASE HOLD.** No production/staging SQL writes, no real applicant/client/staff data, no live service credentials, no external communication, no financial activation, no `main` merge, and no deployment occurred.

*Public repository hygiene: do not paste live credentials, real users, private forensic evidence or exploitable production details into issues or CI logs.*
