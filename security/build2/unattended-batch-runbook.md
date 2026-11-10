# Disposable GitHub Actions batch automation (draft only)

## Scope and entry points
- Branch: `security/build2-step35e-main-delta-draft-20261110`.
- Existing `Security Build 2 offline checks` workflow is branch-restricted to qualifying pushes to the draft branch and can be manually started with **Actions → Security Build 2 offline checks → Run workflow → select draft branch**.
- Each run executes the **same nine allowlisted original migration rehearsals** on a disposable PostgreSQL 17 service with synthetic fixtures, together with existing security tests. This is repeatable unattended *execution*, not autonomous coding or approval of the remaining 17 files.
- The `consolidated-batch-report` job checks all three prerequisite jobs, validates the 26-file inventory and all nine false release gates, and uploads `build2-disposable-batch-report` (JSON, 30-day retention). A failed/skipped prerequisite makes the report job fail closed. A missing report is not evidence of success.
- To review results: GitHub → Actions → select the run → `consolidated-batch-report` → Artifacts → `build2-disposable-batch-report`. Inspect `verification`, `ci_jobs`, `blocked_files` and `status`.

## Safety
- The automation does not call Supabase, Vercel or third-party services, use production credentials, merge, deploy, send messages or enable financial workflows.
- No GitHub secrets or elevated write permissions are needed; workflow permissions are `contents: read`. Release evidence remains nine `passed:false` gates and `HOLD`.
- `network_access:false` in the replay contract is a declared policy, **not** an OS/network isolation mechanism; GitHub-hosted runners can have outbound network connectivity. DB-target assertions and synthetic-only fixtures remain mandatory.
- Pull-request execution is disabled for this draft-only batch workflow, and each job independently checks the authorized draft branch.
- No scheduled trigger is enabled: GitHub scheduled workflows normally run from the default branch, which would violate the current draft-only constraint. Automatic execution occurs on matching draft-branch pushes; manual dispatch is available when a repeat run is needed.
- The remaining 17 original migrations require individual dependency and safety review before changing the allowlist. A 26/26 inventory is **not** a 26/26 replay, and the report must never label it as such.

## Stop conditions
Stop and investigate any failed guard, CI job, inventory change, missing artifact, unexpected DB target, release gate drift, or attempted financial/privileged migration execution. No production readiness or schema equivalence is implied.

## Verified baseline and report visibility
- Baseline commit `0d379aab`: Build 2 run `42772598089` and separate Step 35E run `42772598158` both passed; the Build 2 run uploaded `build2-disposable-batch-report`.
- Subsequent workflow revisions require fresh CI verification on their own commit. The Actions run summary now shows the HOLD status and migration counts without downloading the JSON; missing JSON artifacts fail the upload step rather than merely warning.
- A green run verifies only the currently allowlisted nine original migrations. Do not infer that 17 remaining files have been executed.
