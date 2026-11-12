# Build 78 — Hosted deny probes, nonproduction function hardening and supported Auth Admin bootstrap

**13 November 2026 · DRAFT PR #12 · RELEASE HOLD.**

This build made **actual restricted nonproduction** changes and executed PostgreSQL role probes. It **did not** create GoTrue users, seed candidate/profile/finance rows, activate triggers, access real business rows, merge `main`, deploy production, or send external communications. Formal production/UAT approval counters do not change.

## A. Live hosted SQL evidence

Dedicated isolated Supabase project: `dhlhlasnaapzckjyvffn`. Build 77 structural UAT fixture persists: **19/19 public CRM tables** with enforced RLS, **13/13 security-invoker views**, **32 disabled application triggers**, **16 source-derived trigger functions**, **zero `auth.users` hooks**, **zero Auth users**, **zero profiles/roles/candidates** and **zero public RLS policies**. All application tables remain inaccessible to `anon` and `authenticated`.

`hosted-preauth-64-denials.rollback.sql` performed **64 real live SQL SELECT attempts** under two PostgreSQL roles (`anon` and `authenticated`) across 19 tables + 13 views per role. All 64 were denied by PostgreSQL. The SQL refuses if Auth users or public RLS policies are present, and ends in unconditional ROLLBACK. Actual returned result was:

```
BUILD78_HOSTED_PREAUTH_SQL_DENIAL_64_OF_64_PASS
historical_signed_uat_cases_accepted = 0
```

**These are database role SQL checks, not signed GoTrue-token/PostgREST/browser tests.** They cannot be counted as any of the historical 140 independently accepted UAT cases.

## B. Two privileged source functions hardened on hosted nonproduction

Supabase Security Advisor previously reported two `function_search_path_mutable` warnings:

- `set_assigned_recruiter()` — previously source fingerprint `e400aad0d20359265b58d9718d4f48a4`, now `0b3f5aefd663dae047d866fddc805c96`.
- `track_stage_changes()` — previously `86c1f9eb50c225a673ae61e82d4e7397`, now `1966ef60466b78a94bd0f700a8ae9468`.

`nonprod-harden-two-definers.sql` checks exact original source hashes and that the lab is empty; uses an explicit empty function search path; schema-qualifies the historical candidate-stage ledger write; and revokes EXECUTE from PUBLIC/`anon`/`authenticated`/`service_role`. Rehearsed in PostgreSQL with unconditional ROLLBACK and inspected new fingerprints **before** the real nonproduction migration. Migration **succeeded**. The two app triggers are still **DISABLED**. Function operational behavior is not signed off.

The **original** Build75 preseed exact-production-function check now correctly reports **HOLD with 30/32** exact fingerprints. This is intentional because two functions were hardened. The **new** `hardened-lab-preseed.readonly.sql` pins 30 unchanged and two hardened target function fingerprints. Live execution returned:

```
lab_pinned_app_triggers = 32
not_disabled_app_triggers = 0
auth_user_count = 0
seed_gate = TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION
```

A fresh Security Advisor returned **no `function_search_path_mutable` WARN**. It still reports 24 INFO `rls_enabled_no_policy` findings (19 intentionally denied public fixture tables plus five existing non-public lab tables). These are not claims that UAT access policies are ready.

## C. Supported GoTrue Auth Admin provisioning code — prepared, not executed

`provision-nine-auth-users.mjs` is a **server-side-only** utility using the repo's `@supabase/supabase-js` dependency. It calls `client.auth.admin.listUsers`, `createUser`, and `deleteUser` (compensating cleanup). The utility:

1. Refuses any project other than `dhlhlasnaapzckjyvffn`; requires exact project URL, explicit execution acknowledgement and server-side service-role/secret key, never a publishable/anon key.
2. Refuses to run if the Auth Admin tenant is not empty (the fresh original state); creates **nine distinct `amf-uat-01@example.invalid` ... `09@example.invalid`** accounts via supported GoTrue API, with caller-secret-managed unique strong passwords, `email_confirm=true`, and **no user-controlled role requests or privileged metadata**.
3. Verifies exact nine UUID/email identities after creation, refuses anomalous returned accounts, and attempts to delete accounts created in this invocation on partial failure. It never inserts directly into `auth.users`.
4. Writes UUID-to-slot mapping (no passwords or tokens) to a user-designated file outside the repository with mode 0600 and exclusive creation. The protected mapping is for an approved secret manager, not GitHub issues or logs.
5. Prints only a count on success, never passwords/keys/user subject identifiers, and requires the operator to inspect Auth tenant state after a failed compensation.

**Execution prerequisite:** nine unique test passwords and the **dedicated nonproduction project's server-side Auth Admin credential** must be supplied through a secret manager outside this chat. The connected Supabase app here exposes project/SQL/actions but no Auth Admin account-create operation or service role secret. Consequently **the utility was not executed and no users were created**. No real passwords/service key were committed, requested in chat or fetched from production.

To execute in an approved isolated server environment with the repository's dependencies installed, provide (through a secret manager, **not a shell history/chat/CI logs**) `AMF_UAT_PROJECT_ID`, `AMF_UAT_SUPABASE_URL`, `AMF_UAT_SERVICE_ROLE_KEY`, `AMF_UAT_MODE=EXECUTE`, `AMF_UAT_ACK=I_ACCEPT_ISOLATED_SYNTHETIC_AUTH_ADMIN_NONPROD_ONLY`, `AMF_UAT_MAPPING_FILE` (protected absolute path outside repo), and nine `AMF_UAT_CASE_01_PASSWORD` ... `AMF_UAT_CASE_09_PASSWORD`. Then run `node security/build78/provision-nine-auth-users.mjs`. Do not run until its latest CI and independent scope review are green. After user creation, synthesize eight matching inactive/approved fixture profile/role rows under reviewed provisioning and confirm ninth remains absent; verify `security/build75/isolated-hosted-postseed.readonly.sql`. **Do not install the production `handle_new_user` signup trigger in the lab**.

`provision-nine-auth-users.test.mjs` and `source-contract.test.mjs` test safe execution and rollback behavior without credentials or network; wired into the fast and full security CI. CI is not signed hosted acceptance.

## D. Remaining release gates / forecast

- Hosted UAT blocker #13: protected Auth Admin execution; 9 Auth identities; approved inert row fixture; 8 profile/role links and one unprofiled subject; reviewed RLS access policies; exact hosted signed-session 135 reads, five separately governed writes and expanded 19-table view/anonymous/browser/API checks; independent acceptance.
- Governance blocker #14: `main` protection, independent PR review, actual recovery/PITR, recruitment/HR, finance and privacy/legal decisions, nine authorized release signatures.
- Production: source-reviewed, rollback-controlled remediation of 48 security objects, then an independently authorized merge and deployment. Old production still has live security issues; this nonproduction hardening does not fix them.

**Formal counters remain: 0/48, 0/140, 0/9, 0/6.** Infrastructure progress: two real nonproduction warnings removed, 64 actual denied SQL probes, executable guarded Auth Admin tooling prepared; accepted release progress: zero signed UAT cases.

**Conditional planning range:** approx. 5–10+ substantive CRM iterations to an authorized `main` merge and 15–30+ for the entire six-workstream programme **only if** Auth credentials, independent review and sign-off dependencies become available. This range is uncertain and should not be treated as automatic reduction or a deadline; if they do not, no finite build estimate is defensible.

Source: PR #12 and issues #13/#14. Production-release-hold intentionally active.
