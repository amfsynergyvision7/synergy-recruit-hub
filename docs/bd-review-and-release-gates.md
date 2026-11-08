# CRM Review and Release Gates — 2026-11-09
Status: development branch review, no live changes.

## Verified findings
1. Supabase metadata audit previously identified 15 unconditional public-targeted ALL policies, 13 security-definer views and 16 advisor-flagged anon-executable SECURITY DEFINER functions. Critical release blockers for customer-facing access; do not run blanket DROP POLICY in production.
2. Existing auth middleware validates JWT claims but not explicitly active/approved account on the server; app layout's status gate is UI only. Need server-side trusted membership and RLS checks.
3. User management performs role changes as delete then insert; without a transaction, errors can leave role assignment missing. Requires transactional RPC with audited admin authorization and tenant scoping, not a superficial UI fix.
4. Recruitment clients schema holds company_name and one contact_person/email/phone; inadequate for multiple BD contacts and opportunity types. Proposed BD entities should link without overwriting clients.
5. New BD prototype is in-memory synthetic data only, no Supabase or send operations; cannot be sold or used for actual outreach.
6. Existing package.json has build and lint but no test script. Phase 1 authored tests require a checked-out repo with dependencies; do not claim complete CI coverage.
7. Public repository: never commit secrets, real prospects or personal records; use fictitious .invalid addresses only.

## Changes actually committed in feature/bd-phase1-synthetic-20261109
- Dashboard, organizations, contacts, opportunities, pipeline, tasks and sidebar.
- Validation and duplicate guard; calendar date validation hardened to reject impossible dates.
- 14 authored model tests (12 initial + 2 new).
- Local focused equivalent date-validation expression: 6/6 PASS in isolated Node smoke checks. This does NOT execute full repository tests.

## Prioritized next changes (not yet implemented)
P0: run TypeScript/build/lint and 14 tests in a complete checkout; fix defects; add CI checks that do not deploy. Implement authenticated-only mock access and avoid accidental production route exposure by feature flag when merging is considered.
P0: independently design and validate RLS policy replacements, view/RPC privilege restrictions and transaction-safe role management before any production migration.
P1: add typed BD permission model, stage history and structured validation; improve contact deduplication and task dates/time zones.
P1: user research and accessible responsive UI; add approval-based outreach drafts with no auto-send.
P2: tenant-aware persistent database and existing client handoff only after approved isolated testing, backups and rollback.
P3: future SaaS onboarding/billing after security and product readiness.

## Deployment blockers
No full branch tests/build/browser review; no persistent backend; production RLS risks unresolved; no staging approval; no rollback-tested migration. Do not merge/deploy based on broad 'upgrade everything' request alone. Require explicit scoped release approval once evidence is available.
