# Build 197 — Production approval-helper parity and role-revoked notification READ/UPDATE

**16 November 2026 | DRAFT / REVIEW-ONLY | No staging or production writes | No approved company-policy change**

## Substantive engineering advancement

Build196 established that the proposed 35 RLS policies do not fully withdraw recipient-notification visibility when an approved user's **database role** is revoked but their GoTrue JWT remains valid. Build197 extends this evidence in two ways:

1. It replaces the previous manually constructed `is_approved(uuid)` SQL test function with a **Git-blob-pinned snapshot** of the **actual currently deployed production definition**, obtained using a SELECT-only PostgreSQL catalog query. The deployed definition's text-MD5 was verified as `b001be894ffd87ad17165cf28adea82e`. Its predicate checks `public.profiles.id`, `status='approved'` and `is_active=true`; the test-only snapshot has Git blob `5e8f3f758b2f551111e883141a728a0b82e38373` and a strict named disposable database guard.
2. It confirms an additional **notification UPDATE authorization gap**: while the original draft 35-policy SQL is installed in fictional CI, the still-approved, role-revoked recipient may submit an UPDATE to their own notification, and the SQL field value **actually changes**. A successful HTTP 204 was **not** accepted as proof of a write; the test independently re-read the stored fictional row using the disposable administrator connection and confirmed its value changed.

**No live data record, credential or company-hosted table was accessed in these tests.** The production helper definition was retrieved from read-only routine metadata, not by executing it against real user rows. The source snapshot is used only inside disposable postgres:17; it is **not** an authorized migration or a recommended production-security setting.

## What was changed in source review

[Exact currently deployed `is_approved` function snapshot](./build197-prod-is-approved.snapshot.DISPOSABLE-ONLY.sql.txt) is loaded in the [source-verified full-policy GoTrue test generator](./build195-prepare-full-gotrue.disposable.mjs) after installing the **unchanged** original PR #16 proposed 67→35 SQL and **unchanged** corrected PR #23 caller-bound role helper.

The [separate notifications role-required review candidate](./build196-notification-role-required.REVIEW-ONLY.sql.txt) is extended to add a **current role-membership requirement** to BOTH:
- `notifications_read` SELECT `USING`;
- `notifications_update` UPDATE `USING` and `WITH CHECK`.

This candidate remains deliberately separate from the frozen 35-policy proposal. It is installed **only after reproducing both original read and write gaps**, and only in the disposable test database. It is not approved as an employee/offboarding policy: authorized onboarding, approved-but-roleless staff notices, consent, disclosure limits, and CRM notification semantics still require a qualified owner decision.

The [dynamic role-change regression suite](./build196-role-revocation.disposable.mjs) then proves that the role-revoked user cannot read the fictional notification under the candidate and an attempted update produces **no stored-row change**, regardless of HTTP's 204/no-rows behavior. The test checks the changed `notifications_update` policy has a role-membership predicate in both `USING` and `WITH CHECK`.

**Source-change gate remains HOLD:** the separate candidate deliberately diverges from the exact normalized original 35-policy fingerprint and yields `HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT`. No one may call this reviewer candidate part of the already-verified original 35-policy source without a new qualified code review, policy decision and coordinated migration.

## Exact verified results

[Build197 CI run #43858593760](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43858593760): **four successful substantive jobs**, consisting of:

- **35/35** source contracts, including the pinned production-helper snapshot and disposal guard.
- **25/25** adverse PG17 permission/policy cases correctly returning HOLD with rollback.
- The original exact 67→35 SQL-source rehearsal, both base/object/fingerprint checks, and complete restoration of the 67-policy pre-state.
- **85/85** fictional GoTrue-issued JWT/PostgREST HTTP assertions: the original 58 baseline cases and **27** role/approval/notification read-write scenarios. The run prints the original notification-read gap, the original stored UPDATE effect, the candidate-denied post-change UPDATE effect, and the expected policy-fingerprint HOLD. It verifies the disposable committed-test database was removed.

## Remaining risk despite greater test fidelity

The real production `is_approved` helper is currently `SECURITY DEFINER` with **`search_path=public`**. This is the legacy deployed configuration, not a recommendation or evidence of secure ownership/search path. The PR #16 full-object proposal still has independent compatibility and least-privilege risks. The test does not replace production triggers, other helper bodies, legacy service caller inventory, incident investigation, real Auth host, mail/audit writer integration, or legal/billing/CRM workflow review.

The proposed notification policy is still a **business and privacy decision**, not something a test runner can self-approve. Before acceptance, Security/Privacy/CRM owners must decide whether roleless-but-approved accounts require limited onboarding/offboarding notices, inspect contents and recipients, test any alternative self-service channel, approve all exact predicate source changes and validate end-to-end hostile and legitimate cases with fictional records on a **separately authorized hosted environment**.

Outstanding release conditions: coordinated [draft PR #16](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16), [draft PR #23](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/23), and [draft PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) approval; independent qualified security/DBA/privacy/code reviews; branch protection; genuine backup/PITR restore; all applicable 140 hosted UAT cases; nine go-live signatures; and real production after-state checks.

[Notification decision release issue #28](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/28) remains OPEN for independently authorized reviewer routing.

## Formal score (no artificial milestone inflation)

- Overall programme **26/100 (26%)**; **12/43 milestones** accepted, **31** outstanding.
- Category C (Lead Discovery) **6/10 (60%)**, with LD02/LD05 missing independent accepted evidence.
- Production security object remediations accepted **0/48**.
- Hosted signed UAT accepted **0/140**.
- Go-live signatures **0/9**.
- **NO MERGE / NO PRODUCTION DEPLOYMENT / NO HOSTED SQL / NO EXTERNAL EFFECTS.**

*This public repository must not be used to disclose real tokens, real PII, private incident evidence, or exploitable production attack instructions.*
