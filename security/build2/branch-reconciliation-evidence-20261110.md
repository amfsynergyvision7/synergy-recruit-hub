# CRM security branch reconciliation — evidence and draft-only plan
Date: 2026-11-10
Status: REVIEW ONLY. NOT A MERGE, DEPLOYMENT, DATABASE MIGRATION, OR RELEASE APPROVAL.

## Independently checked refs
- Build 2 PR #11: draft/open/unmerged, head 7a4260a8374cad3f8b0d4b6d1e78a41770a681d6 before this documentation commit.
- Build 2 versus main: ahead 244, behind 27; 144 changed files.
- Step 35E branch versus main: ahead 40, behind 0; 20 changed files.
- GitHub compare of the two branch change sets against main showed **zero matching changed file paths**. This is a file-path-level result, not a semantic or dependency compatibility proof.
- Build 2 latest three CI jobs: application build/typecheck, offline security, isolated PostgreSQL — all successful on 7a4260a8.
- Step 35E latest CI: success on f6512d50; an earlier run failed and must not be represented as the latest status.
- Existing release gate intentionally blocks 9/9 production conditions.

## Non-overlapping change sets still require cross-checks
Step 35E touches:
- package.json and scripts/vercel-build.mjs: ensure canonical security tests run when integrated.
- src/integrations/supabase/auth-middleware.ts and client.ts: check approved/active account enforcement and credential handling.
- src/lib/ai.* and email.*: preserve outbound AI/SMTP deny-by-default.
- src/lib/security/record-access.ts and release-gates.*: verify server-side record authorization.
- src/routes/_app.tsx: UI status gate is not a database permission boundary.
- tests/step35e-* and tests/security-release-gates.test.mjs; tests/sql/step35e-isolated-rls-check.sql.
- .github/workflows/step35e-security-gates.yml.

Build 2 touches security/build2/**, security-build2-offline workflow, and CRM component/route changes. Its SQL drafts must remain review-only.

## Required integration sequence (not executed)
1. Freeze exact branch SHAs and produce a new isolated draft integration branch, never main.
2. Integrate current main into the draft branch with review of commits and dependency semantics, preserving Step 35E transport denials and Build 2 RLS/RPC designs.
3. Run both workflow test suites plus build, TypeScript, lint, and dependency/security checks.
4. Re-run synthetic SQL tests and cross-role negative cases on a CRM-compatible disposable database, not production.
5. Browser-test authenticated, pending/inactive, Recruiter A/B, Operations, Finance/Viewer, Admin; include export, view, RPC, ownership, and outbound AI/SMTP denial.
6. Complete metadata-only inventory and audited migration/rollback plans; verify real restore in an approved isolated environment.
7. Obtain specific release approval only after evidence is complete; keep PR draft and production blocked until then.

## Explicit release disposition
HOLD: no live CRM security claim, no staging/production SQL writes, no production merge/deploy, no financial workflow activation. This document closes only the **path-overlap reconnaissance** task, not branch reconciliation or release acceptance.
