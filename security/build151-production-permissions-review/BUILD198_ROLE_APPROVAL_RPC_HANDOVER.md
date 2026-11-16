# Build 198 — Source-exact role and approval RPC caller-scope review

**16 November 2026 | Security design review ONLY | NO production/staging SQL | NO main merge | RELEASE HOLD**

## Why Build198 was needed

Build194 repaired the **uninstalled** caller-bound `has_role(uuid,app_role)` proposal in draft PR #23, while Builds195–197 demonstrated proposed full 35-policy behavior with locally GoTrue-issued tokens in a disposable database. **Two other current production SECURITY DEFINER functions, `get_user_role(uuid)` and `is_approved(uuid)`, still accept caller-provided UUIDs.** Merely revoking anonymous EXECUTE in the original PR #16 proposal does not restrict the information obtainable by an ordinary authenticated caller.

Build198 inspected their current definitions **read-only** from PostgreSQL catalogs; no staff role records, profile rows or actual RPCs were read/executed in hosted production. The checks showed all three current privileged helpers allow anon/authenticated EXECUTE in the production catalog and have legacy `search_path=public`; a real-world API exposure assessment must be performed separately.

## Exact input and regression evidence

- [Live `get_user_role(uuid)` definition snapshot](./build198-original-get-user-role.DISPOSABLE.sql.txt) is read-only catalog sourced, text-MD5 `83d72d3932a91c90ffa33f431063a831`, Git blob `19ed98d1216c6ef4ef55deabfaef9e21172dc544`. It retains the deployed ordered-role semantics (admin > recruiter > operations > finance > viewer).
- [Live `is_approved(uuid)` definition snapshot](./build197-prod-is-approved.snapshot.DISPOSABLE-ONLY.sql.txt) is read-only catalog sourced, text-MD5 `b001be894ffd87ad17165cf28adea82e`; checks approved status and active profile.
- Both real routine definitions are replayed **only after** the unchanged original PR #16 67→35 policy SQL, corrected PR #23 `has_role` and fictional GoTrue users are installed in the guarded `amf_build195_gotrue_35_policy_lab` PostgreSQL 17 CI database. **Original migration source and production functions unchanged.**
- [Build198 issued-JWT behavioral cases](./build198-real-role-rpc.disposable.mjs) first confirm that, under the unmodified original live function bodies with proposed PR16 grants, a fictional recruiter authenticated by an actual GoTrue-issued JWT can obtain another fictional employee's role and approval status. Anonymous access to these functions is rejected by the PR16 *proposed* grant model. The cases also confirm own lookups and an approved-but-roleless raw-membership nuance. These synthetic results do **not** demonstrate actual production REST reachability or any real person's information being accessed.

## Two separate, unapproved candidate repairs

[Caller-bound `get_user_role`](./build198-caller-bound-get-user-role.REVIEW-ONLY.sql.txt) keeps the same function signature and ranked role selection but returns SQL `NULL` for an unauthenticated, NULL-target or foreign-user lookup. It removes public/anonymous execution, retains authenticated self-lookup and the previous direct service-role grant. **Administrative cross-user lookup would change**: a separately authorized server-only administrative RPC may be required to preserve legitimate workflows.

[Caller-bound `is_approved`](./build198-caller-bound-is-approved.REVIEW-ONLY.sql.txt) returns a strict Boolean `FALSE` for unauthenticated, NULL-target or foreign-user lookup, retaining the currently deployed approved+active test for the signed-in caller. It also removes public/anonymous execution and leaves the previously direct service-role grant, but its **no-subject behavior returns FALSE** and could break service/Edge/trigger callers that legitimately check another user's approval. Both candidates have empty search paths and qualified table names. Their body/grant changes must be independently examined before any real patch.

The candidates were applied only *after* reproducing original behaviors, in a separate step inside the throwaway CI database. Own-role/own-approval lookups, fictional admin/recruiter/finance access, and full sampled 35-policy row authorization continued to work. The previously tested 58 baseline and 27 revoked-role/notification cases also continued to pass. This is useful **compatibility evidence, not complete business/CRM parity**.

## New false-positive control for helper body drift

The existing [Build192 exact 35-policy fingerprint](./build192-exact-35-policy-fingerprint.readonly.sql) checks policy **predicates** but cannot detect changes to privileged helper **function bodies**. The new [read-only helper-source fingerprint query](./build198-lookup-functions-fingerprint.readonly.sql) pins the two *original deployed* helper definitions; it emits `REVIEW_ONLY_LEGACY_FUNCTION_SOURCE_MATCH_NO_RELEASE` only if both sources match those original text hashes, and `HOLD_LOOKUP_HELPER_DEFINITION_DRIFT` otherwise.

Its CI test confirmed the original two helper bodies match; replacing either one with its review-only candidate changes the helper-source gate to HOLD. **The legacy-match result is not a judgement that the original code is secure.** If reviewers authorize new function bodies, these source pins must be updated through a *separate* reviewed change, not silently marked green by the 35-policy fingerprint.

## Latest verified run

[**Build198 final source branch CI #43862401868**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43862401868) passed **all four substantive GitHub Actions jobs**:

- **38/38** source-contract tests PASS.
- **25/25** negative disposable PostgreSQL object/permission tests returned the expected HOLD, with full rollback.
- Original exact source 67→35 RLS/48-object draft rehearsal completed, verified unchanged draft 35-policy digest, and restored the original 67 policies after rollback.
- **112/112** fictional GoTrue-issued-JWT → PostgREST → proposed 35-policy/PR23 helper HTTP checks PASS: 58 baseline + 27 revocation/notification scenarios + **14** role-lookup and **13** approval-lookup original/candidate cases. Function-body original/source-drift checks behaved as intended. The committed CI database was **dropped and deletion explicitly verified**.

**None of these are hosted acceptance cases**. Synthetic auth users, schema, billing, notifications and candidate records are deliberately fictional; existing production trigger/service function bodies and external application paths are not fully integrated. The separate notification read/write candidate from Build197 remains unapproved and policy-fingerprint HOLD.

## Mandatory independent decision and limitations

Security, Privacy, CRM and DBA reviewers must decide whether a staff member may look up any other employee's role or approval state; enumerate authorized admin/offboarding and server jobs; inspect actual Code/Edge/RPC/trigger callers and grant/session behavior; and approve a least-privilege administrative design if necessary. **Do not apply either candidate directly from this public repository.** This security work must be reconciled with draft PR #16, PR #23 and PR #18, and the unresolved notification policy decision in [issue #28](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/28). A dedicated [Build198 qualified-review issue #29](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/29) tracks the additional role/approval caller decision.

Company-hosted real GoTrue-signed UAT of **140** acceptance cases, verified backup/PITR recovery, branch protection, independent PR reviews and **nine** final go-live signoffs remain absent. Connected production continues to have the old **67 RLS policies**, legacy anonymous EXECUTE to role helpers and other permissions blockers. No remediation was applied there.

**Formal programme score unchanged:** overall **26/100 (26%)**, **12/43** milestones accepted and **31** open; Category C **6/10 (60%)**, LD02/LD05 unaccepted; production security changes accepted **0/48**, hosted signed UAT **0/140**, release signatures **0/9**.

**RELEASE HOLD: no production/staging writes, no real person data, no financial activation, no external communications, no `main` merge or deployment.** Keep any live incident evidence, secrets and private user identifiers in a restricted security channel rather than public GitHub.
