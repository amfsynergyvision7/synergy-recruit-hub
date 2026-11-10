# Security CI pull-request coverage parity — 2026-11-10

## Draft-only fix
The `pull_request` trigger of `.github/workflows/security-build2-offline.yml` previously monitored `security/build2/**` and the workflow itself but not the guarded application source files. A source-only PR update to `CrudModule.tsx`, `CandidateBoard.tsx`, or `_app.candidates.tsx` could therefore fail to trigger these checks from the PR event. Added the same three application paths to the pull-request filter, matching the push filter.

Added `security/build2/workflow-pr-path-parity.test.mjs` to prevent future drift between push and pull-request security CI path filters.

## Verification
GitHub Actions run #382: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42702839198
All three jobs passed: application build/TypeScript, offline security tests, isolated PostgreSQL.

## Limitations
Workflow path coverage is not a branch-protection requirement and does not prove that GitHub settings require checks before merge. No merge, deployment, staging/production writes, external communication, or financial workflow changes. All nine production release gates remain false.
