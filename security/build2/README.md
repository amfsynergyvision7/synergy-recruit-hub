# Build 2: proposed CRM RLS remediation (NOT APPROVED FOR DEPLOYMENT)

Status: design and synthetic tests only, 2026-11-09. Branch: `security/build2-rls-ai-design-20261109`.

## Verified production metadata findings
- 15 public tables have an unconditional PERMISSIVE `ALL` policy called `Allow all for authenticated` with `USING true` and `WITH CHECK true`, targeting PUBLIC (including anon).
- 13 views are owner-privileged and selectable by anon/authenticated.
- 16 SECURITY DEFINER functions are reported as anon-executable; confirm RPC vs trigger exposure separately.
- Existing database migration history was returned empty, although repository SQL migrations exist.

**Do not apply the SQL in this directory to production.** The migration is a proposed staging-only, fail-closed candidate for review; it deliberately does not recreate every legacy write policy. Application regression tests and a full migration inventory are mandatory.

## Approved AI access design
- Admin/CEO: operational records within authorization; sensitive attachments, contact details, billing require separate authorization.
- Recruiter: assigned records only (using verified assignment relation), limited allowed fields.
- Operations: authorized interviews only; candidate name and interview details, NEVER phone, email, resume, salary. Operations assignment mapping is NOT verified: deny until it is.
- Finance, Viewer, other/unknown roles: no individual CRM records through AI.
- Every request must check approved + active profile, server-resolved role, record ownership/assignment and explicit field projection.
- AI endpoints are read-only; never expose arbitrary SQL, email, resume processing, sync or write functions.

## Staging verification gates
1. Snapshot current RLS policies, grants, view definitions, function signatures, triggers and dependent app routes; review service-role bypass.
2. Create isolated staging project with synthetic-only data and confirm it is not connected to production.
3. Run pre-migration synthetic role tests for anon, pending, suspended, inactive, finance, viewer, recruiter own/other, Operations assigned/unassigned, Admin.
4. Apply reviewed migration to staging only, validate SELECT/INSERT/UPDATE/DELETE for each affected table and all CRM workflows.
5. Check view and RPC privileges, search_path, triggers and security advisor; verify no privilege escalation, unauthorized joins or count leakage.
6. Verify rollback in staging, obtain CEO's separate approval for production migration and deployment.

## Files
- `proposed_rls_restrictions.sql`: intentionally unapproved SQL proposal for staged review.
- `ai-access-policy.mjs`: deterministic, synthetic-only reference policy.
- `ai-access-policy.test.mjs`: Node built-in test runner; run `node --test security/build2/ai-access-policy.test.mjs`.

No production SQL executed or production configuration changed in preparing this branch.

## Security review continuation — 2026-11-09
- Fresh live **metadata-only** inspection confirmed the 15 `PUBLIC ALL true` policies still exist. No business records read or live SQL modified.
- The security advisor still reports 13 privileged views, 16 anonymous-executable SECURITY DEFINER functions, four mutable function search paths and an RLS-enabled table without policies; each issue needs compatibility review.
- Offline audit now checks open `WITH CHECK` INSERT/UPDATE as well as open `USING` SELECT/UPDATE/DELETE; 18 synthetic RLS tests.
- AI example is restricted to authorized interview records and nonblank IDs; 29 synthetic AI tests.
- **47/47** combined tests passed on an isolated Node 22 mirror of this branch's source. No SQL engine, complete repo build, browser or live authorization test was performed.
- `metadata-snapshot-readonly.sql`: review-only metadata queries, no schema/data modification.
- `release-readiness-and-rollback.md`: outstanding blockers, role/row/field policy requirements, test gates and release conditions.
- Current security branch has diverged from `main` and must be reconciled before any PR or production consideration.
- Existing `proposed_rls_restrictions.sql` is still **NOT a complete fix** and MUST NOT be deployed.

Local checks from a complete checkout:
```sh
node --test security/build2/rls-policy-audit.test.mjs security/build2/ai-access-policy.test.mjs
```
