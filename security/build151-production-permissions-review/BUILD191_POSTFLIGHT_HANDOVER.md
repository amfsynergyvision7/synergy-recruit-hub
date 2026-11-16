# Build191 — 48-object / 35-policy read-only postflight and owner handover

**16 Nov 2026 · DRAFT · DO NOT APPLY / MERGE / DEPLOY.** No hosted writes or private data-row reads.

## Material technical change

The original PR #16 48-object preflight only checked anonymous TRUNCATE among table permissions. It was intentionally narrow, but a future partial remediation could have left anonymous SELECT/INSERT/UPDATE/DELETE or column-level privileges without being detected by that part of the test. The new, **separate** [review-only full postflight](./build191-postflight.readonly.sql) refuses that incomplete condition.

The new query checks exact **19 public tables / 13 views / 16 existing privileged functions**, proposed **2 account-management functions**, exact **35-policy shape** across 19 tables, and zero unrestricted PUBLIC ALL policies. It additionally checks anonymous table/column permissions, only three authorized branding column SELECT rights, authenticated TRUNCATE/REFERENCES/TRIGGER/MAINTAIN denial, direct browser role/profile mutations, 13 security-invoker views, privileged function EXECUTE, service/helper compatibility grants, lack of anonymous/authorized role BYPASSRLS/superuser and public-schema CREATE privileges. It never calls those privileged functions or reads any business rows.

It returns only `REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE` for a matching **catalog shape** and `HOLD_48_OBJECT_AND_35_POLICY_POSTFLIGHT_INCOMPLETE` otherwise. **Even a positive metadata result does not prove authorization logic, functioning audit writers or deployment approval.**

## Verification and false-positive sensitivity

The *same source SQL* ran with **SELECT-only** access against connected production and isolated nonproduction. **Both returned HOLD**, for different incomplete security/compatibility reasons. No customer/CRM/candidate/user-role/audit/billing rows were read, no RPC called, and no hosted writes executed.

[PG17 disposable test](./build191-postflight-disposable.pg17.sql) creates an entirely fictional 19-table/13-view/16-function/2-RPC/35-policy catalog with deliberately inert functions and deny-all row policies. The synthetic candidate produces only the `REVIEW_ONLY` metadata result, then **25 independent negative mutations** must each produce HOLD. These include anonymous SELECT/INSERT/UPDATE/DELETE, dangerous authenticated grants, direct account writes, view/SECURITY DEFINER exposure, missing service/helper permissions, unrestricted PUBLIC ALL, branding-field leaks, missing policy/table/RPC, BYPASSRLS, and public-schema CREATE grants. All 25 mutations are savepoint-reverted, safe fictional metadata is rechecked, and the full transaction is rolled back. This **does not rehearse actual 67→35 SQL deployment** or certify CRM behavior.

[**GitHub Actions #43834456035**](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43834456035): **26/26** source contracts PASS, **25/25** adverse PG17 cases correctly HOLD, complete rollback independently verified. Both jobs succeeded.

## Mandatory qualified owner sequence — still outstanding

1. Assess live Data API exposure, existing role/column/owner grants, all actual external service and audit writers and possible incident indicators via approved confidential review. Decide any emergency containment using change control, without personal-data probing or unreviewed broad revocations.
2. Coordinate existing [draft PR #16](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16) 48-object and 67→35 policy design with [draft PR #23](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/23) audit/helper security and [draft PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) email/outbox integrity. Do not execute the partial legacy 48-object lockdown independently.
3. Verify all account/security-definer function bodies, function caller compatibility and real GoTrue/Auth signed behavior, and independently approve a least-privilege business access matrix.
4. Rehearse **hosted fictional data** with full **140 signed cases**, test all legitimate audit, sync, and correspondence recording paths, and demonstrate verified backup/PITR restore and rollback.
5. Protect `main`, obtain genuine independent reviewer approvals, close release/security acceptance milestones and collect **9 go-live signoffs** before authorized production change.

**Formal acceptance unchanged:** 26/100 overall, 12/43 milestones accepted, 31 outstanding; Category C 6/10 awaiting LD02/LD05. Production 0/48 independently accepted remediation objects, 0/140 hosted signed UAT, 0/9 release signoffs. Public GitHub is not a confidential incident channel; do not post credentials or live exploitation details.
