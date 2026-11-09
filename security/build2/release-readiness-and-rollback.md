# Build 2 — CRM permissions security review and controlled release gates
**Assessment date:** 2026-11-09. **Status: development validation improved; PRODUCTION RELEASE BLOCKED.**

## Scope and verified evidence
- Repo: `amfsynergyvision7/synergy-recruit-hub`; branch `security/build2-rls-ai-design-20261109`.
- Latest branch comparison during this review: 8 security-branch commits ahead and **27 commits behind main** before the updates documented here. Recheck before integration.
- A fresh **read-only, metadata-only** Supabase query confirmed that the 15 named sensitive tables still contain a permissive `ALL` policy `Allow all for authenticated` targeting `{public}`, with `USING true` and `WITH CHECK true`.
- Supabase security advisor reports 13 security-definer views; 16 anonymous-executable security-definer functions (also executable by authenticated); four mutable function search paths; one RLS-enabled table without any policy; and one password leak-protection advisory. Findings require individual review; advisor counts alone do **not** prove exploitation.
- The original migration history in the repository has application dependencies: trigger-backed stage changes, relationship normalization, role helpers, profile approval and admin role workflows.
- Application gate in `src/routes/_app.tsx` is a **UI gate**; it must not be mistaken for database authorization.
- Existing `profiles` self-update policy and broad `user_roles` policy must be reviewed together. A row-level predicate does **not** prevent updating sensitive columns such as `status`, `is_active` or `role`.
- `app_settings` currently has an unconditional public-read policy; its intended public-branding behavior must be assessed separately from sensitive private tables.

## Offline work completed
- Expanded `rls-policy-audit.mjs` to flag open `USING` and open `WITH CHECK` permissions, including INSERT/UPDATE/DELETE and pg_policies role formatting.
- Expanded `rls-policy-audit.test.mjs` to 18 synthetic tests.
- Restricted `ai-access-policy.mjs` to known interview entities and nonblank user identities; expanded tests to 29.
- Executed a local Node.js 22 isolated test mirror of the branch source and test cases: **47/47 pass, 0 fail** (18 RLS + 29 AI). This is offline JavaScript verification only, NOT SQL/RLS integration, CI, browser, app build or production verification.
- Added `metadata-snapshot-readonly.sql` containing only metadata SELECT statements, intentionally outside `supabase/migrations`.

## Required database policy design before any deployment
1. **Identity:** independently verified `auth.uid()`, profile `status='approved'`, `is_active=true`, server-trusted role; deny pending/rejected/suspended/inactive accounts.
2. **Reassignment protection:** prevent client-controlled changes to `profiles.status`, `profiles.is_active`, `user_roles`, `created_by`, `assigned_recruiter` or equivalent ownership columns. Use narrowly scoped grants, trusted admin workflow, and explicit UPDATE `USING` plus `WITH CHECK`; test both old and new row.
3. **Table-specific row scopes:** candidates/jobs by verified recruiter assignment; submissions/interviews/offers by linked candidate and authorized workflow; clients only via explicitly approved relationships; finance/billing restricted to approved financial workflows; integrations, tokens, audit and sync logs privileged only.
4. **Operations:** proposed explicit interview assignment relation is **not implemented**; deny all Operations AI reads until independently verified. Do not reuse broad candidate/interview joins for AI.
5. **Fields:** RLS is not column filtering. Define server-side explicit projections and minimal column grants; test joins, views and exports for candidate phone, email, salary, resume and attachments.
6. **Views and functions:** inspect all 13 view definitions and each callable security-definer signature and dependency. Prefer `security_invoker` where compatible; restrict API EXECUTE as appropriate without breaking triggers.
7. **Service role:** no service-role bypass or privileged SQL connection for AI requests. Audit existing server routes, background jobs and email/notification workflows separately.
8. **Public repo:** never commit credentials, live records, private database output or incident details.

## Execution and rollback gates (mandatory, in order)
- [ ] Reconcile security branch with **current main** safely and review conflicts; inspect Vercel/GitHub preview triggers before any PR or merge.
- [ ] Obtain a complete **metadata-only** snapshot using `metadata-snapshot-readonly.sql` (or equivalent) and document exact columns/grants/functions/trigger dependencies.
- [ ] Produce and review a full 15-table, operation-by-operation RLS migration **replacing** broad and overly liberal legacy policies. The existing `proposed_rls_restrictions.sql` is a partial removal-only draft and must NOT be applied as a release migration.
- [ ] Prepare a backup/recovery procedure, pre/post migration policy snapshots and reviewed reverse migration. Verify actual restore and rollback, not just SQL syntax.
- [ ] Verify all affected routes and workflows using a completely separate **synthetic** database or approved isolated local test environment. No paid staging resources were approved.
- [ ] Run negative tests as anon, unapproved/inactive, Recruiter A vs Recruiter B, Operations assigned/unassigned, Finance/Viewer, Admin; test SELECT, INSERT, UPDATE, DELETE, role elevation, ownership changes, views, RPC, joins and export pathways.
- [ ] Run complete application tests, build, lint and browser checks; security synthetic tests alone do not establish compatibility.
- [ ] Re-run Supabase security advisor; document every remaining exception (not all advisories can be fixed blindly).
- [ ] Obtain separate informed CEO production-change authorization after the above tests pass, with maintenance and rollback plan.
- [ ] Only then execute a reviewed migration in production, perform post-change functional and security verification, and retain audit evidence.

**Current deployment decision: HOLD.** No live SQL writes, configuration change, production merge, deployment, real candidate/customer record reads or paid staging performed in this work.

## Acceptance criteria
No unrestricted public policy remains on sensitive CRM data; unauthorized users cannot read or mutate private rows via tables, views or RPC; a user cannot approve/activate/promote themselves; recruiter records are isolated; Operations never receive candidate contact/resume/salary through AI; existing approved CRM operations survive the change; validated backup/rollback is ready; all required tests and CEO release approval are recorded.
