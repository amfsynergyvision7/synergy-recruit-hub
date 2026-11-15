# Build177 — independent audit-log security review, isolated against `main`

**Status: DRAFT / REVIEW-ONLY / DO NOT MERGE / DO NOT APPLY / NO PROD OR STAGING SQL.** This is a focused, self-contained isolation of a critical security remediation packet already developed in [unmerged security PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) from integration-branch commit [`42b98783517aecec9feb2d33530b717c1d7f1857`](https://github.com/amfsynergyvision7/synergy-recruit-hub/commit/42b98783517aecec9feb2d33530b717c1d7f1857). It is not an accepted fix, a live migration, an emergency change order or a completed database restore.

## Why this smaller PR exists

PR #18 contains a broad integration branch and other CRM/email work. The urgent `public.audit_logs` privilege exposure needs a small, qualified-DBA-reviewable package targeting `main` directly. The five files under `reviewed/` are **byte-for-byte original Git blobs**, not new or independently approved SQL:
- `lockdown.DO-NOT-APPLY.sql.txt` — a **proposal only** to revoke unsafe privileges and remove the universal ALL policy, while preserving the admin SELECT reader; must be reconciled against application audit writers
- `audit-integrity.preflight.readonly.sql` — existing fail-closed catalog check, not an application access proof
- `audit-producer-inventory.readonly.sql` — metadata inventory only; cannot find every external/dynamic writer
- `audit-grant-matrix.readonly.sql` — exact 8-privilege matrix and RLS/owner evidence without business rows
- `reconcile-confirm-sent.DO-NOT-APPLY.sql.txt` — proposed trusted manual email reconciliation procedure: **never run independently of app compatibility, backup, manual DBA review and protected security checks**

## Revalidated Build176 production/lab evidence (15 Nov 2026)

Production `audit_logs`: RLS enabled, **FORCE disabled**; 3 policies, including one permissive PUBLIC ALL with USING true / WITH CHECK true; `anon` and `authenticated` each hold all **8/8** effective table privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN); service_role 8/8. The named `crm_email_confirm_sent_trusted` procedure is absent. Isolated nonproduction: RLS enabled and forced, 0 policies, anon/authenticated 0/8, service_role 8/8, named RPC absent. **The copied preflight returned HOLD on both**. This is confirmed unsafe authorization, **not proven API reachability, theft or tampering**. Neither business records nor audit-event rows were read.

Live PostgreSQL catalog search found no noninternal table trigger on audit_logs, no incoming FKs, no `public` functions whose bodies literally contain `audit_logs`; this is not a complete writer inventory. Supabase security advisors report 52 production lint findings, including 13 security-definer view ERROR findings. See [critical issue #19](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/19).

## Review/decision gates in required order

1. Qualified, distinct DBA/security reviewer must confirm **all** writers: app, triggers, dynamic SQL, outbox, service processes, external integrations; verify actual role/API exposure and urgently decide authorized temporary containment vs staged full remediation
2. Reconcile proposed audit grants and trusted RPC with [DRAFT 48-object/RLS PR #16](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/16), [DRAFT email security PR #18](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18), SMTP send-before-audit integrity and admin-only reader policy
3. Backup/PITR restoration and rollback plan verified by an independent owner with required change approval; nonproduction **real-role** behavioral UAT and expected business logging outcomes passed
4. Execute approved changes in controlled maintenance through separately authorized change-management process, never by this workflow, with source-pinned before/after catalog readbacks, actual auth/role tests and independent release signatures
5. Protect `main` with a real GitHub ruleset and independent reviewer. This PR must remain **Draft** until protection and all independent release gates clear. An intentional `main-release-hold` CI job always fails.

## Disposable CI boundary

This PR intentionally introduces **no app runtime, migration directory, package dependency, CRM, Auth, external contacts or live SQL writes**. The `.github/workflows/build177-audit-main.yml` action uses **no secrets**, checks exact copied Git blobs, and uses an **ephemeral PostgreSQL 17 service** to rehearse a transaction-local subset of proposed grant revocations against fictional roles and a fictional table, followed by `ROLLBACK`. It **never runs the proposed reconciliation FUNCTION** and cannot certify app compatibility, PITR, the unobserved writer inventory, independently approved DB change or production safety.

## Source-provenance pin

Original source branch `42b98783517aecec9feb2d33530b717c1d7f1857`, copied blobs:

- `security/build177-audit-main/reviewed/lockdown.DO-NOT-APPLY.sql.txt` ← `security/build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt` (Git blob `568298c8556d21adb26afd6a583ecad8d8d4f0f0`)
- `security/build177-audit-main/reviewed/audit-integrity.preflight.readonly.sql` ← `security/build160-email-reconciliation/audit-integrity.preflight.readonly.sql` (Git blob `16a656ca76bbda43d9c9d6015b16e4e5d4c04d59`)
- `security/build177-audit-main/reviewed/audit-producer-inventory.readonly.sql` ← `security/build162-audit-access/audit-producer-inventory.readonly.sql` (Git blob `1b3e1c75d8daeb85659b499dc6e8fe48fd28516a`)
- `security/build177-audit-main/reviewed/audit-grant-matrix.readonly.sql` ← `security/build163-audit-grants/audit-grant-matrix.readonly.sql` (Git blob `296dd81c4a20b40de929bf5e06f3f53cbb1e2777`)
- `security/build177-audit-main/reviewed/reconcile-confirm-sent.DO-NOT-APPLY.sql.txt` ← `security/build160-email-reconciliation/reconcile-confirm-sent.DO-NOT-APPLY.sql.txt` (Git blob `a5c9d51cd34d888bc2b4283270e3adaaff99c382`)

**Outcome sought:** smaller audit-security review PR; do not award official CRM09 acceptance, do not change the fixed programme 26/100 / 12-of-43, and retain `main` merge, email/financial/CRM activation and production deployment holds.

## Build177 CI harness correction before validation

The first PR workflow run exposed **two harness failures**: the JS Git blob hash helper used a backslash-zero text sequence instead of a NUL byte; the quoted Docker service `--health-cmd` was passed as unsupported CLI tokens. These were corrected in the *test and GitHub workflow*, not in any of the five source-pinned reviewed SQL blobs. The disposable PostgreSQL proof is valid only after a clean rerun. Nothing has been applied to either hosted database.

## Build178 — role-inheritance verification and authentic preflight HOLD after mock REVOKE

**Read-only hosted catalog evidence (15 Nov 2026):** Production and dedicated nonproduction role-membership / direct ACL inspection shows `anon`, `authenticated` and `service_role` have their **own direct** audit-table grants and do **not** inherit from one another. The `authenticator` role has these three roles with `inherit_option=false`, `set_option=true`. Database owner `postgres` has broader inherited memberships and `BYPASSRLS`; `service_role` also has `BYPASSRLS`. These facts do **not** prove API-level reachability and do **not** authorize revocation. Reviewers can rerun the new catalog-only `role-inheritance.readonly.sql` in both projects. The new source does not read any data rows.

**Material CI gap closed:** Previous Build177 disposable test checked eight effective privileges and rollback but **never executed** the authentic Build160 release preflight after mock lock-down. The Build178 PostgreSQL17 job now runs the original unmodified source-pinned release preflight **both before and after** the proposed privilege reductions. It models the existing admin-reader policy syntax with a synthetic deny-all function. The expected result remains **HOLD** before (overbroad grants/policy) and **HOLD** after (no trusted manual reconciliation RPC). This explicitly prevents passing the mock revocation from being reported as a production/CRM09 release. PostgreSQL 17 transaction rollback and the original five Git-blob SHA checks are still mandatory.

No hosted SQL writes, no authentication or CRM records, no automation activation or external messages. This is a qualified DBA review support package only; actual production permissions remain unsafe pending independent authorization and controlled remediation.

## Build179 — adversarial catalog-gate sensitivity (not authorization)

Build178 only demonstrated that the source-pinned Build160 catalog query correctly returned HOLD in its incomplete/unsafe examples. Build179 adds a **separate disposable PostgreSQL17 transaction** with a *fictional inert no-op reconciliation function* whose SQL identity and ACL match the preflight's catalog checks. The preflight must return exactly `REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE` for that **synthetic catalog signature**; this positive mock control proves the gate is not merely hard-coded to HOLD. However, the no-op function deliberately demonstrates that **catalog matching alone cannot prove code behavior, provider confirmations, legitimate writer compatibility, backup/restore readiness, production permission safety or operational authorization**. The `REVIEW_ONLY` text is NOT an approval.

Twelve independent synthetic negative mutations (anonymous read/TRUNCATE, authenticated update/MAINTAIN, service delete/TRIGGER, universal policy, public function execute, service execute revocation, SECURITY DEFINER, admin reader removal, and service INSERT removal) must each push the unmodified preflight back to HOLD. Savepoints revert every mutation, then the mock control is rechecked and the full container transaction rolled back; no hosted database is accessed. **The five original reviewed SQL blobs remain byte-identical.** Independently signed DBA/security evaluation of the *real* function's semantics, role permissions and workflow is still mandatory, as is protected `main` and production security remediation.

## Build179 — confirmed PostgreSQL17 preflight false-HOLD bug and separate proposed correction

In an ephemeral PG17 role/policy fixture, the **unchanged original Build160 preflight** returned HOLD despite matching fake catalog configuration. Catalog inspection confirmed its predicate expects `search_path=`, whereas PostgreSQL17 stores `SET search_path=''` as `search_path=""`. The source-pinned original reviewed SQL is **not changed**; the new **proposal only** `audit-integrity.pg17-corrected.readonly.sql` checks the observed exact PG17 GUC and enforces the RPC argument types `uuid,uuid,text,text` rather than only four arguments. No operational authorization or production SQL is implied.

Disposable CI now checks original false-HOLD, corrected mock `REVIEW_ONLY_AUDIT_RECONCILIATION_CATALOG_MATCH_NO_EMAIL_RELEASE` for a **deliberately inert no-op procedure**, fourteen unsafe privilege/policy/function mutants reverting to HOLD, and final transaction rollback. Even the positive result **does not establish actual function behavior**, reviewer signoff, app compatibility, production readiness or release acceptance; the mock confirms exactly why catalog-only verification is insufficient. `main`, production and every real security action remain HOLD.
