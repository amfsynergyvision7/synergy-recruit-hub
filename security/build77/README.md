# Build 77 — real nonproduction structural UAT bootstrap (13 November 2026)

**Repository:** `amfsynergyvision7/synergy-recruit-hub` · **PR:** #12 DRAFT / RELEASE HOLD · **Target:** isolated synthetic Supabase `dhlhlasnaapzckjyvffn`. **No production SQL, `main` merge, deployment, real business records or synthetic Auth identities were altered.**

## Deployed, with actual hosted success responses

1. `nonprod-public-19-source-shaped-rls-deny.sql` — **successful nonproduction migration** after correcting constraint ordering. Copied *DDL metadata only*, not records or defaults: 19 source-shaped public tables, 239 columns, three original enum types and 75 original PostgreSQL constraints (19 primary, seven unique, 42 foreign-key, seven check). All 19 tables have RLS and FORCE RLS. Anon/authenticated privileges explicitly revoked; no app policies yet.
2. `nonprod-13-security-invoker-views.sql` — **successful nonproduction migration**: 13 exact source-derived view definitions compiled as `security_invoker=true`; anon/authenticated table/view access revoked.
3. `nonprod-32-disabled-source-triggers.sql` — **successful nonproduction migration**: 16 application-trigger function definitions from production catalog and 32 application triggers pinned against Build75's hashes. Every trigger explicitly DISABLED in the same migration transaction; application function EXECUTE revoked from PUBLIC/anon/authenticated/service_role. **No `auth.users` bootstrap hook** copied. Seven of the 16 functions are SECURITY DEFINER; they remain uncallable by app roles and triggers stay disabled. Trigger functions/side effects have NOT been operationally UAT-tested and must never be enabled or granted without separate isolation tests.

## Live readback evidence

Existing authoritative `security/build75/isolated-hosted-preseed.readonly.sql`, executed *after* all three successful migrations, returned:

```json
{
  "matched_tables": 19,
  "actual_public_tables": 19,
  "rls_enabled_tables": 19,
  "anon_truncate_tables": 0,
  "authenticated_truncate_tables": 0,
  "matched_views": 13,
  "actual_public_views": 13,
  "invoker_views": 13,
  "anon_readable_views": 0,
  "actual_app_triggers": 32,
  "source_exact_app_triggers": 32,
  "not_disabled_app_triggers": 0,
  "auth_user_hooks": 0,
  "auth_user_count": 0,
  "seed_gate": "TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION"
}
```

Additional count-only query independently confirmed **239 columns**, **19 force-RLS public tables**, zero anon/authenticated table privileges, zero application policies, zero Auth users and zero publicly executable application functions for those roles. Security advisor's `rls_enabled_no_policy` informational notices are expected while the staged fixture intentionally has no access policies; they MUST NOT be dismissed as tested access rules.

## Post-migration security-advisor findings

- 16 application functions, seven SECURITY DEFINER, zero executable by `anon`, `authenticated` or `service_role`; all 32 triggers remain disabled.
- Security Advisor WARN: two source-preserved SECURITY DEFINER functions lack fixed search paths: `set_assigned_recruiter()` and `track_stage_changes()`. Source hash fidelity required retaining their original definitions; neither is approved for activation. Hardening will require a separately reviewed migration and new pinned hashes.
- Security Advisor INFO: 24 RLS-enabled-with-no-policy notices: 19 intentionally deny-all public fixture tables and five existing separate lab tables. No signed-user authorization policies exist yet.
- Refer to https://supabase.com/docs/guides/database/functions for function-grant and search-path guidance.

## Known limitations; technical PASS is not signed UAT

- Preseed gate **PASSED technically**; independent lab design/side-effect isolation approval and actual approved synthetic seeding remain separate requirements.
- All 19 tables presently deny app roles; **zero** Auth test users, **zero** application policies, **zero** fixture records, and **zero** accepted signed sessions. Do not claim that any recruiter/admin role or view now works.
- Supabase connector does not expose a GoTrue Auth Admin account-creation action; inserting directly into `auth.users` is unsafe and not permitted. An authorized server-side Auth Admin workflow with a secret manager is required for exactly nine invented `example.invalid` identities, eight profiles, eight roles, and one deliberately unprofiled/unroled ninth user.
- Before inserting fake fixtures, define explicit inert values for workflow, email, sync and finance defaults; validate the nine-user postseed checker and later run independent trigger-operational compatibility.
- Do not copy production `handle_new_user` or the hard-coded email-based administrator bootstrap mechanism. Do not grant `EXECUTE` on SECURITY DEFINER functions without scoped review.
- After identity and RLS fixture approvals, run genuine hosted 135 READ cases, separately gated five WRITE cases, and current view/browser/API/anonymous positive/negative tests. Independent test acceptance and sign-off required.
- Release governance remains open in #14: `main` branch protection, independent reviewer, signed nine gates, recovery/PITR and HR/legal/finance approval. Not represented as completed by this build.

**Release acceptance unchanged:** **0/48** production remediations, **0/140** accepted real hosted UAT cases, **0/9** signed gates, **0/6** programme closures. Infrastructure is demonstrably closer to hosted UAT; formal release sign-off is not.

**Planning estimate:** conditional **5–10+ CRM** and **15–30+ six-workstream** iterations after remaining Auth Admin, human-review and governance dependencies are available. Not a guaranteed countdown.

## GitHub evidence

- This directory contains the **actual deployed SQL source**, with no user records or secrets.
- Base audit: `security/build75/live-trigger-and-auth-hook-manifest.json`, `security/build75/isolated-hosted-preseed.readonly.sql`.
- Tracking: Issue #13 (hosted UAT); Issue #14 (release governance); PR #12 (draft source, not approved production migration).

**Rollback caution:** These migrations are applied to the isolated **nonproduction** project. Removing the objects would require a separately reviewed controlled nonproduction teardown after verifying that no synthetic account or test records have been inserted; do not casually delete lab schemas or attempt a production rollback by copying this script.
