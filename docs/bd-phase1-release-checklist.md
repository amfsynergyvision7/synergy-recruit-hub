# Business Development Phase 1 — Verification and Release Checklist
Date: 2026-11-09
Branch: feature/bd-phase1-synthetic-20261109
Status: development only; no production approval.

## Gate A — complete checkout and automated verification
- [ ] Obtain a full repository checkout in an isolated local environment.
- [ ] Confirm Node.js 22 and install dependencies from the lockfile (prefer npm ci).
- [ ] Run `npm run test:bd` and confirm all 21 tests pass.
- [ ] Run `npm run lint`; record errors and warnings.
- [ ] Run `npx tsc --noEmit` if supported by project tsconfig; record any unrelated baseline failures separately.
- [ ] Run `npm run build`; confirm Vercel-compatible output and no missing modules.
- [ ] Inspect route generation for /bd and imported UI components.
- [ ] Do not report a green build without actual command output and exit code.

## Gate B — synthetic UI acceptance
- [ ] With VITE_ENABLE_BD_DEMO unset, /bd displays disabled message and sidebar hides demo link.
- [ ] With VITE_ENABLE_BD_DEMO=true, admin can see demo and non-admin cannot use demo.
- [ ] Seed data is explicitly synthetic; page warns against personal/confidential data.
- [ ] Add organization/contact/opportunity/task; verify related entity selection and counters.
- [ ] Reject duplicates, invalid email, invalid date and unknown references; preserve form inputs on error.
- [ ] Move opportunity stages and mark tasks complete/reopen; verify summary counts.
- [ ] Verify local date handling around midnight and mobile responsive layout.
- [ ] Refresh resets demo data; no Supabase reads/writes or outbound sends.

## Gate C — security before persistent records
- [ ] Reconcile existing GitHub migrations with deployed Supabase schema (read-only first).
- [ ] Replace broad permissive RLS policies using reviewed, reversible migrations; verify effective permissions.
- [ ] Audit SECURITY DEFINER views/functions and EXECUTE grants.
- [ ] Enforce active-account and role authorization server-side, with tenant isolation verified.
- [ ] Use transactional, audited role-management operations.
- [ ] Verify assigned-record visibility and deny-by-default tests with synthetic identities.
- [ ] Approve and test backups/rollback before any production SQL.

## Gate D — production readiness and explicit approval
- [ ] Confirm scope, impact, rollback plan, release owner and acceptance evidence.
- [ ] Confirm no new paid services or charges without explicit approval.
- [ ] Obtain separate explicit authorization to merge, deploy, and apply any live SQL.
- [ ] Perform post-deployment smoke tests and monitor errors; roll back if checks fail.

## Immediate constraints
GitHub connector can review/edit source but current container has not obtained a complete network-enabled checkout. Source readback checks are not a substitute for executable tests or browser QA. No automatic production deployment, live Supabase SQL or real customer records authorized by this checklist.
