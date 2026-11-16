# Build194 — Combined PR #16 authorization policies + PR #23 role helper

**16 November 2026. DRAFT SOURCE REVIEW ONLY. NEVER APPLY THESE REVIEW FILES TO A HOSTED DATABASE.**

## Concrete issue discovered and corrected

The first cross-branch test found that the originally proposed `has_role(uuid,app_role)` in draft PR #23 could return **SQL NULL** when a signed-in user supplied a NULL target UUID. A nullable result denies an RLS predicate, but can violate the expected strict Boolean contract of an HTTP/RPC caller. The combined run therefore failed its test (correctly, before any hosted change), and existing isolated Build187/189 tests were insufficient because they lacked this particular null-target case.

The **actual PR #23 proposal** was then corrected: it now explicitly requires `_user_id IS NOT NULL` as well as a non-null `auth.uid()` and equality to that signed subject. A NULL target returns **BOOLEAN FALSE**; no user-role enumeration was introduced. This is a change to the **unapplied draft**, not to production.

## Combined source integration proof

- PR #16's reviewed **67→35 policy and 48-object proposal** is unchanged. Its final `COMMIT` is still withheld in CI; old 67 policies are restored by unconditional ROLLBACK.
- The new source snapshot [`build194-role-helper.PR23-SNAPSHOT.DO-NOT-APPLY.sql.txt`](./build194-role-helper.PR23-SNAPSHOT.DO-NOT-APPLY.sql.txt) is byte-for-byte the **corrected PR #23 source** at Git blob `309b62681dd6ce221f24733766aa9b48da845c8f`. The PR #16 source tests refuse any changed blob SHA until it is explicitly re-reviewed and updated. **It is a snapshot for test integration, not an additional migration or an independent grant source.**
- The combined [role/row behavior test](./build193-rls-authorization.disposable.pg17.sql) replaces its old stand-in `has_role` implementation with that **actual PR #23 snapshot** while leaving `auth.uid` and `is_approved` as fictional, GUC-backed test fixtures. Within the same unchanged 35-policy transaction, it checks self-role true, foreign-user false, NULL-target false, no-subject false, preserves the current explicit `service_role` EXECUTE grant but returns false for a no-subject service request, and preserves the Build193 admin/recruiter/finance/pending-user RLS row and limited write matrix.
- Its execution is blocked unless the test is inside the exact disposable `amf_build192_full_policy_lab` database, under `postgres` session ownership, and both fake account RPCs exist. The outer migration is always ROLLBACKed. No hosted credentials, applicant records, production user UUIDs, service API keys, external emails or financial effects were accessed.

**Verified [PR #16 CI run #43846448438](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43846448438):** **31/31** source contracts PASS, **25/25** adverse privilege/policy cases return HOLD with rollback, and the exact combined 67→35 SQL/PR23 helper/35-policy RLS and restore tests PASS. The original 67-policy fingerprint and absence of both proposed account RPCs after rollback were confirmed.

**Verified [PR #23 CI run #43846608991](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43846608991):** **24/24** source contracts PASS; **26/26** HMAC-signed synthetic PostgREST/RPC/RLS cases PASS; **27/27** disposable actual GoTrue-issued token HTTP/RPC/RLS cases PASS; all 30 prior PG17 negative cases remain HOLD, revised null-target test PASS, and complete rollback verified. The build's dedicated `main` release-HOLD job deliberately FAILS. A pinned two-branch static caller inventory also passes. **Overall PR #23 workflow remains red on purpose.**

## Remaining real-world release blockers

- **No hosted SQL applied:** live read-only production metadata still shows the original **67 policies**, original SECURITY DEFINER role helper with `search_path=public`, and anonymous EXECUTE. The 48-object authorization remediation and new helper remain **drafts**.
- **No complete function integration:** the test uses synthetic `auth.uid()` and `is_approved()`, does not run the production helper/approval function bodies or all external/backend service callers, and cannot determine whether a legitimate `service_role` operation depends on cross-user lookup. If the helper now denies a no-subject service call, a separately qualified server-only administrative design may be necessary.
- **No hosted signed GoTrue UAT:** PR #23 tests use genuine GoTrue tokens only inside isolated CI for a *different miniature policy schema*. The combined full 35-policy test uses fake session identity GUCs. Full hosted 140-case validation, including privacy, admin, CRM and audit writer paths, is absent.
- **Security owner decisions:** review PR #16 with PR #23 and email/outbox PR #18 as one coordinated change; independently approve helper owner, search path, grant relationships, all 35 policy semantics, 13 views, other advisor findings, external writer inventory, backup/PITR restoration and rollback. Protect `main`, obtain genuine independent reviews and all nine go-live signoffs.

## Acceptance and forecast

Build194 **fixes a draft Boolean-contract defect** and proves two **specific draft designs** compose under fictional PG17 conditions; this is **not** a production remediation or milestone acceptance. Official programme remains **26/100 (26%)**, **12/43** accepted, **31** open, Category C **6/10 (60%)**, live security remediation **0/48**, hosted UAT **0/140**, signoffs **0/9**.

**Release: HOLD.** No production/staging SQL writes, customer records, external communications, financial activation, merge or deployment were performed. The count-only 11–31+ remaining acceptance-build arithmetic is contingent on one to three independently signed milestones per build and is not a dependable completion timeline.
