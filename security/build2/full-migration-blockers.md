# Release blockers discovered while drafting complete 15-table policy replacement
2026-11-09. **HOLD: not ready for execution**.

`full-rls-replacement-review-only.sql` is a **fail-closed conceptual draft**, not a verified migration. It replaces every legacy permissive policy on 15 tables and removes anonymous table privileges. It has since been executed against synthetic PostgreSQL 17 stubs in isolated GitHub Actions, but NOT against a complete production-shaped schema or application. Do not copy it into `supabase/migrations` or execute against production.

## Blocking compatibility and authorization issues
1. `profiles` and `user_roles`: revoke authenticated writes to prevent self-approval/role elevation, but this **also breaks the current UI admin approval/role-management workflow** until a narrowly authorized server-side replacement exists. No such replacement was implemented or verified.
2. `candidates`: existing creation paths may set `assigned_recruiter` null. The draft requires an explicit assigned recruiter; otherwise recruiter INSERT will fail. Need server workflow review and column immutability enforcement to prevent reassignment by recruiter.
3. `job_openings`: same null-assignee compatibility issue. Confidential jobs and salary require field-level protection; RLS only filters rows.
4. `submissions`/`interviews`: draft restricts writes to Admin pending a verified ownership relationship and business-workflow tests. This may disrupt recruiter operations.
5. `offers`, `clients`, `candidate_activities`, `audit_logs`, `sync_logs`: draft denies most non-admin actions. Some triggers and existing workflows may need trusted internal writes and audited grants.
6. `billing`: Finance read may be appropriate for operational CRM but AI Finance access remains denied. Separate authorization layers must be tested.
7. `notifications`: marking own rows read must not permit editing recipient, message or type; needs column grants or a dedicated privileged RPC.
8. `google_integrations`: verify admin ownership and service integration paths. Never expose credentials.
9. `public.has_role` and `public.is_approved`: SECURITY DEFINER execution and search paths must be verified before relying on them.
10. 13 owner-privileged views and 16 anonymous-executable SECURITY DEFINER functions are **not** fixed by table RLS alone.
11. Free GitHub Actions now provides disposable PostgreSQL 17 SQL integration tests; latest verified run #106 passed 12 groups. These tests do not cover complete live schema, data or application behavior.
12. GitHub compare on 2026-11-10 reports the security branch diverged: 97 commits ahead and 27 behind `main` (62 files in comparison). No merge, preview or production deploy was performed.

## Minimum criteria to lift HOLD
- Full migration and exact reverse migration are reviewed and tested on **free local PostgreSQL** or an already-existing free isolated database, with synthetic users and data.
- All role and record negative tests pass, including self-elevation, role updates, ownership changes, views, RPC, confidential fields and admin workflows.
- App tests, build and browser checks pass; backups/restore tested.
- Branch reconciled with current main and deployment triggers reviewed.
- Explicit release record identifies tested commit, database snapshot, rollback, owner and maintenance window.

**CEO decision:** use free resources only. Do not create a billable Supabase branch. The CEO's broad implementation approval does not make an untested, potentially disruptive production change safe.

## 2026-11-10 evidence correction
Earlier paragraphs are historical drafting notes, not current test status. Verified isolated CI: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42684794707 (both jobs passed; 12 SQL groups). All nine production release evidence flags remain false; a synthetic rollback test does not count as full production recovery rehearsal. `run_workflow_rules()` dynamic target-column authorization remains a priority unresolved blocker.
