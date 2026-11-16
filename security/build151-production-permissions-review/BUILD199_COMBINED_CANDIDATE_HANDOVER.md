# Build 199 — Combined candidate integration and source-caller inventory

**16 November 2026 | DRAFT / independent security review needed | NOT approved for merge, staging or production**

## What materially advanced

Previous Builds196–198 tested the notification-role restriction and the two privileged helper caller-bound fixes **one after the other** in fictional PostgreSQL/PostgREST. This build adds a further regression stage that verifies all **three separate review-only candidates remain installed simultaneously** with the **unmodified, source-pinned proposed 35 RLS policies** and the corrected draft PR #23 `has_role` function.

[Build199 combined 33-case runner](./build199-combined-candidates.disposable.mjs) is now invoked at the end of the [complete GoTrue-issued JWT integration test](./build195-full-gotrue-35-policy-http.test.mjs). Its three input review-only SQL blobs are pinned by immutable Git blob hashes and MUST NOT be treated as actual migrations:

| Candidate | Git blob SHA | Independently reviewed? |
| --- | --- | --- |
| Notification `SELECT` and `UPDATE` require current role membership | `9100d89d6f63316fac798cd50e29070642649cc8` | **No** — business/privacy owner policy needed; issue #28 |
| `get_user_role(uuid)` binds lookup to signed-in caller | `54c61175b92ede5cc9a010abc4a30545103f35cf` | **No** — admin/service caller review needed; issue #29 |
| `is_approved(uuid)` binds lookup to signed-in caller | `0765668ec71d066a6e78dfd3bef25556690bb742` | **No** — service/privileged caller review needed; issue #29 |

The **actual original draft PR #16 policy SQL and PR #23 helper source were not changed**. The candidate overlays are installed only inside the ephemeral `amf_build195_gotrue_35_policy_lab` database; the test refuses other database names, users, hostnames or missing CI-specific environment guards.

The full test chain authenticates five entirely fictional users through a **locally hosted, real GoTrue** issuer; PostgREST verifies signed JWTs and executes against local PostgreSQL 17 with the exact original proposed 35-policy set. Nothing is tested with actual AMF employees, candidates, clients, production tokens or production/staging databases.

## Confirmed combined behaviors

New 33-case Build199 group, **all verified in the final CI**:

- Approved administrators, recruiters and finance users retain sampled expected RLS table reads; pending-admin and finance cross-domain restrictions continue to deny data.
- Legitimate signed-in self-role and self-approval RPC calls work, while authenticated cross-user `get_user_role` / `is_approved` probes return NULL / FALSE, and anonymous RPC access remains denied.
- Approved role-bearing users can read and update *their own* notifications. An already-issued valid JWT loses both recruitment and notification access after the server-side role is removed. The declined notification `UPDATE` is checked against **stored fictional row values**, not merely HTTP status.
- **Approved profile status and current role membership are not equivalent.** After role deletion, `is_approved` still returns TRUE but `has_role` is FALSE and `get_user_role` returns NULL. Data-access and notification policies separately enforce role membership.
- Restoring the membership enables legitimate sampled access again without refreshing the JWT. Deactivation, reactivation, suspension and reapproval correctly alter access and approval checks.
- A privileged `service_role` session with **no authenticated user subject** has an existing direct EXECUTE grant, yet all three caller-bound helper candidates return no cross-user authorization data. This deliberately fail-closed result is **also a major compatibility risk** for legitimate backend, scheduled, administrative and external service workflows. A narrowly scoped separate internal administrative design may be required.

**Exact-source verification remains a release blocker on purpose:** the full 35-policy fingerprint returns `HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT` with the notification overlay, and the two privileged function-source fingerprints return `HOLD_LOOKUP_HELPER_DEFINITION_DRIFT` with the role/approval candidates. Matching an older source digest does not approve the original unsafe design, and new digests cannot be substituted without qualified review.

## New tracked-source caller inventory

Build199 also introduced [`build199-repository-caller-inventory.test.mjs`](./build199-repository-caller-inventory.test.mjs) to automatically scan checked-out repository-owned `src` and `supabase` code during the CI source-contract job. The **verified runner output** reports:

- **157** source and SQL files scanned.
- **3** generated Supabase type declarations referencing the privileged functions.
- **86** references in checked-in migration SQL across 11 historical migration file paths.
- **0** *literal, direct named* references to `has_role`, `get_user_role`, or `is_approved` outside the type/migration sources, within the scanned application/Edge source.

This is a useful baseline, **not a determination that no real callers exist**. Existing deployed functions, dynamic RPC names, platform integrations, external/connected systems, Edge deployments not represented in the repository, trigger chains, migration-defined SQL routines and manual administrative workflows remain outside the static check. Any new **direct named runtime source use** will now fail CI until independently reviewed. No private CRM/user data is read by this test.

## Final CI (four substantive jobs ALL SUCCESS)

[**Build199 Actions #43906463051**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43906463051)

| Job | Result |
| --- | --- |
| Source checks + tracked-source caller inventory | **40/40 PASS** |
| Disposable PG17 adverse privilege/policy mutation cases | **25/25 expected HOLD and rollback** |
| Exact source 67→35 SQL replay, exact predicates, rollback to original 67 | **PASS** |
| Issued GoTrue-JWT → PostgREST full 35-policy/PR23 integration | **145/145 assertions PASS (112 prior + 33 combined)** |
| Ephemeral database cleanup | **Removal verified** |

CI green indicates **the unapproved candidate combination behaves in these fictional scenarios**. It does not approve authorization semantics, change production, prove deployed frontend/backend compatibility or close formal acceptance.

## Required independent release decisions / evidence gates

1. **Notification semantics** (issue #28): determine whether role-revoked but approved staff need onboarding/offboarding notices and define a deliberately restricted alternative if appropriate. Review both `notifications_read` and `notifications_update`.
2. **Admin and background-service compatibility** (issue #29): identify every actual consumer of `get_user_role`, `is_approved` and `has_role`, including migration-defined routines and deployed/background integrations. Determine whether existing cross-user administrative operations must use a separately authorized internal, auditable server-only RPC. The new service no-subject test is deliberately a **review HOLD**, not proof that services can safely run unchanged.
3. **Source and SQL review**: independent Security, DBA, Privacy and CRM approval of a new *coordinated* migration covering PRs #16, #23, #18 and the three candidates as needed. Verify function ownership, search paths, grants, target-specific RLS, triggers, view exposure and critical audit/log writer compatibility. Keep source fingerprints blocking until a specific approved version is reviewed.
4. **Operations**: approved backup/PITR restore test, protected `main`, independent genuine pull-request reviews, signed hosted fictional-user UAT against the real company environment (140 cases), nine qualified go-live approvals, and a supervised change window. **Do not infer these from local GoTrue CI.**

## Formal programme score, unchanged

**Overall 26/100 (26%)**, **12/43** accepted milestones, **31 open**; **Category C 6/10 (60%)** (LD02 and LD05 not independently accepted), production security remediations accepted **0/48**, hosted signed UAT accepted **0/140**, final go-live signatures **0/9**.

Release decision: **HOLD**. No hosted production/staging writes, no real business records, no external communications, no financial activation, no merge into `main` and no production deployment.

*Public repository hygiene: never place actual PII, real secrets, production-issued tokens, incident-level forensic detail or sensitive exploit evidence in public GitHub comments or CI logs.*
