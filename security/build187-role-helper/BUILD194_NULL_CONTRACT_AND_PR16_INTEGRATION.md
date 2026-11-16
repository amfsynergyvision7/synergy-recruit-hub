# Build194 — NULL-safe caller-bound role helper + combined draft RLS review

**16 November 2026 · PR #23 DRAFT / REVIEW ONLY / DO NOT APPLY**

## Corrected defect

The PR #23 `public.has_role(_user_id uuid, _role public.app_role)` draft originally checked `auth.uid() IS NOT NULL AND _user_id = auth.uid() AND EXISTS(...)`. If a **signed-in caller passed `_user_id=NULL`**, SQL's three-valued logic could return **NULL** instead of **FALSE**. Inside an RLS condition NULL denies access, but RPC clients should receive an unambiguous Boolean. A brand-new combined PR #16 + PR #23 test exposed this previously untested case in the disposable SQL environment.

The [corrected DO-NOT-APPLY proposal](./has-role-current-user.DO-NOT-APPLY.sql.txt) explicitly includes `_user_id IS NOT NULL`. The original source signature, SECURITY DEFINER rationale, empty search path and limited authenticated execution model remain unchanged. The server-side `service_role` direct EXECUTE grant is preserved but no-session identity behavior still changes to FALSE and requires independent caller review.

## Verified source-specific tests

[Build194 PR #23 CI #43846608991](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43846608991) ran the exact changed helper under:

- A disposable PG17 behavioral fixture that asserts NULL-target returns **SQL BOOLEAN FALSE, not NULL**; cross-user role lookups remain false; legacy anonymous EXECUTE is removed, user-scoped RLS checks still work, and full rollback occurs.
- **26/26** actual HTTP checks through PostgREST with synthetic signed JWTs, including NULL role target false; all anonymous/tampered/expired controls still pass.
- **27/27** disposable genuine GoTrue-issued JWT HTTP checks for fictional admin, recruiter, finance and unassigned users, including NULL target false. This is *not* connected or hosted Supabase Auth UAT.
- **24/24** source-contract checks and all **30/30** existing disposable PostgreSQL adverse permission cases. The main-release-HOLD job intentionally fails, keeping the overall PR #23 workflow red. The 355-file pinned source-caller inventory also passes.

A separate [PR #16 combined test](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16) now snapshots the exact corrected helper **Git blob `309b62681dd6ce221f24733766aa9b48da845c8f`** and applies it in the **same never-committed transaction as the actual 35-policy proposal**, verifying role ownership, admin/recruiter/finance permissions, NULL/missing subject denial and full 67-policy rollback. Its [Build194 CI #43846448438](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43846448438) confirms **31/31** source contracts, **25/25** negative PG17 security cases and combined actual SQL/row behavior PASS.

**This is a reproducible cross-branch integration test, not authorization to merge those two separate draft proposals or apply them to production.** A qualified DBA must reconcile source chronology, direct `service_role` grants, owner search path, all actual RPC/Edge/service callers and the 41 current production RLS consumers. Actual GoTrue-hosted UAT, approved PITR restoration, privacy/security signoffs, protected `main`, 140 hosted scenarios and nine go-live approvals remain unfulfilled.

## Formal release

Connected production remains at the old 67 policies and old helper. No production/security milestone closed. Overall **26/100**; **12/43** accepted and **31** open; Category C **6/10**. **Release HOLD, zero hosted SQL writes, zero merge or deployment.**
