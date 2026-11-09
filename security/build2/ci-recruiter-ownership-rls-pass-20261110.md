# Recruiter ownership RLS and silent zero-row update regression — verified 2026-11-10

GitHub Actions run #206: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42690910157

All three jobs succeeded: application build/TypeScript, 129 Node tests, and **20 PostgreSQL PASS groups**. New disposable test: `security/build2/synthetic-recruiter-ownership-rls.integration.sql`.

The synthetic PostgreSQL 17 test uses two candidate owners, a simulated recruiter principal, a SELECT ownership policy, and an UPDATE policy with both USING and WITH CHECK. It confirms:
- recruiter A sees only their own candidate;
- attempting to update recruiter B's candidate affects zero rows (no SQL error);
- attempting to reassign A's candidate to B is rejected by the RLS WITH CHECK;
- a permitted stage update to A's own candidate succeeds.

This directly supports the app-side returned-ID confirmation fixes: an RLS-filtered zero-row UPDATE cannot safely be interpreted as success based only on the absence of a database error.

**Limitations:** synthetic schema and identity, not actual production policy deployment; the real live `set_assigned_recruiter()` trigger remains a default-only helper, and admin reassignment rules and automated creation workflows require separate authorization and regression testing. Do not infer production ownership protection from this synthetic test.

No production DDL, business-row access, merge, deployment, or external communication. Nine release gates remain blocked.
