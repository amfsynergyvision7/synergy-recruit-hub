# Build196 — Live-JWT role revocation and draft notifications policy review

**16 November 2026 | Unmerged review evidence | No hosted SQL, production/staging records, external communications or go-live approval.**

## Why this was the next necessary integration test

Build195 proved that the original proposed 35-policy/48-object SQL and corrected PR #23 `has_role` accepted **58/58** validly issued *fictional* GoTrue JWT/PostgREST HTTP test requests. Build196 extends that **same source-hash-pinned disposable environment** to answer whether an *already issued and still valid* JWT remains authorized when an administrator changes the user's **database role** or **approved/active profile**. These permissions are server data, not refreshable client role claims.

The test maintains the same GoTrue-issued JWT and PostgREST connection between before/after checks. PostgreSQL fixture modifications are performed only by the disposable synthetic-admin fixture, guarded to `amf_build195_gotrue_35_policy_lab`, `127.0.0.1`, `postgres` session, the special CI-only flag and fake records. The original PR #16 and #23 **DO-NOT-APPLY proposal SQL files remain unchanged**.

## Confirmed issue in the unmerged proposed 35 policies

The first new CI attempt produced a meaningful **failed test**: after deleting the fictional recruiter's `user_roles` membership, the same previously issued JWT immediately lost access to assigned candidates, jobs, submissions and ability to insert a candidate, but **could still read one fictional recipient notification**. That result was consistent with the original proposed `notifications_read` policy: it checked `is_approved(auth.uid())` and the recipient, but did not require current role membership.

An approved, active account can therefore still see its own notifications after its role has been removed. The content and sensitivity of production notifications remain **unreviewed**; this is a **release-design gap in draft authorization semantics**, not evidence that any actual user's data was accessed or a confirmed production incident. A separately qualified Security/CRM owner must decide whether role-revoked staff should retain a minimized notification channel for onboarding or offboarding, or whether all private notifications must be denied.

## Proposed safer candidate: separate, review-only, not part of the approved 35

[Build196 review-only role-required policy](./build196-notification-role-required.REVIEW-ONLY.sql.txt) adds an explicit **current user-role membership** requirement to the proposed notification SELECT authorization, in addition to the existing active/approved check and recipient/admin conditions. This is NOT an approved business policy. It is not part of the original frozen 35-policy SQL source or a migration. The candidate is executed **only after** the original gap has been reproduced in the disposable full-policy CI test. It does not change production or either unmerged original proposal.

The test then confirms role-revoked notification access becomes **zero rows**, while the user may still read their own profile for account-state visibility. It also verifies the candidate changes the original 35-policy fingerprint and triggers `HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT`, as intended. This is important: an altered review candidate **cannot silently pass the Build192 exact policy-source gate**. Until independently approved, the frozen original should remain under release HOLD; do not quietly edit its fingerprint to call the candidate accepted.

## Verified dynamic authorization behavior in the same JWT session

After the 58 unchanged Build195 HTTP cases, **24 additional** Build196 assertions now pass:

| Transition / issue | Expected and observed in the disposable proposed-policy model |
|---|---|
| Delete recruiter role while JWT remains valid | Existing token still identifies self profile, but candidates, jobs, submissions, role row and role-helper membership become unavailable |
| Notification access after role deletion, **original frozen policy** | **One fictional recipient row remains visible — flagged as release HOLD** |
| Apply separate notification-policy candidate only in disposable DB | That notification row becomes invisible; exact proposed policy fingerprint now correctly returns HOLD |
| Revoked recruiter attempts an INSERT | Denied |
| Restore recruiter role without refreshing JWT | Own role and assigned candidates/jobs immediately become available |
| Mark approved recruiter's profile inactive without deleting role | Role helper still reports membership, but assigned candidates, jobs, notifications and writes are denied |
| Reactivate profile | Previously assigned records become available again |
| Mark profile suspended while role remains present | Assigned candidate/submission data denied although raw role membership still exists |
| Reapprove profile | Access restored for the fictional approved recruiter |

The test demonstrates that *membership* and *approval* must both be evaluated and that authorization reacts to their database state in this fixture. Real production function bodies and service callers are not represented by these stand-ins.

## Final verified CI

[**Final Build196 GitHub Actions run #43854586764**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43854586764) contains **four successful substantive jobs**:
- **34/34** source contract checks PASS.
- **25/25** PG17 adverse privilege/policy cases return expected HOLD and full rollback verified.
- The existing unchanged actual SQL 67→35 source replay, exact original-source fingerprint/tamper-detection and rollback restores 67 original policies.
- **82/82** GoTrue-issued fictional JWT/PostgREST HTTP assertions pass — **58** original exact-source cases plus **24** new revocation/approval/notification-gap-and-candidate checks. The run explicitly prints the original notification gap and expected source-fingerprint HOLD for the candidate. The test stops GoTrue/PostgREST, drops the throwaway committed SQL database and verifies its absence.

## Mandatory independent closure requirements

1. **Security/Privacy/CRM owner policy decision** on notification contents and whether a role-revoked, approved account may retain any private notification visibility. Do not infer business/legal authorization from the test.
2. If the stricter candidate is approved, prepare a **new coordinated migration/review** that includes the exact predicate source, review of dependencies and refreshed policy fingerprints. The original PR #16 and #23 draft sources are not edited by Build196.
3. Verify real server/helper code, role-change workflows, stale JWT behavior, account suspension, job routing, offboarding/onboarding notices, notification UPDATE authorization, external service jobs and actual GoTrue **hosted** Auth with fictional records.
4. Conduct independent DBA/security reviews, test the full 140 hosted UAT cases, preserve backup/PITR restoration evidence, protect `main`, and obtain the nine go-live signoffs. None is replaced by a green disposable test.

**Formal project acceptance unchanged: 26/100 (26%), 12/43 milestones accepted, 31 open; Category C 6/10 with LD02/LD05 outstanding, production security remediation 0/48, hosted signed UAT 0/140, final signatures 0/9. DRAFT / RELEASE HOLD / NO MERGE / NO DEPLOYMENT.**

This repository is publicly accessible. Qualified reviewers should handle current live incident-level evidence, real personal data, API secrets or any exploit path through a restricted company security channel, not public GitHub comments.
