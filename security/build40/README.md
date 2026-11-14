# Build 40 — public object scope and app compatibility audit (REVIEW ONLY)

Verified live scope: 19 public tables (including candidate_stage_history, email_log and workflow_rules), 13 actual production view definitions and 16 SECURITY DEFINER function signatures. All 19 public tables explicitly grant anon and authenticated TRUNCATE, with no inherited PUBLIC TRUNCATE grant found. The 15 broad policies, 13 anon-readable views and 16 anon-executable functions remain in production.

Three independent rollback-only PostgreSQL 17 fixtures: exact 19-table/13-view grant review SQL and 239 production-derived column definitions; full 16-function signature/ACL matrix using synthetic placeholder function bodies; and a 19-table authenticated/anon column-grant proposal with a minimal branding exception. None is an active migration.

The repository audit scans literal .from and .rpc calls in the actual application source. Findings are compatibility risks for human verification, not permission/security proof.

Formal acceptance remains 0/140 signed-user cases, 0/9 release gates, and 0/48 production object remediations for the now-expanded 19 table + 13 view + 16 function scope. The prior 45-object count omitted candidate_stage_history, email_log and workflow_rules. No merge, production/staging writes, scheduler activation, customer record operations or financial activation.

Main remains unprotected; independent reviews, real JWT/API/browser tests, complete migration/reverse, restore verification, and idempotent synchronization are release blockers. PRODUCTION RELEASE HOLD.
