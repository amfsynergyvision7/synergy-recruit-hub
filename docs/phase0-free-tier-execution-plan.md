# Phase 0 — Free-tier verification and release gates

Date: 2026-11-09
Status: development branch only; no production authorization implied.

## Cost boundary
- Reuse the existing public GitHub repository, standard GitHub-hosted Actions runners for public repositories, Vercel Hobby and existing Supabase configuration.
- Do not activate paid features, purchase staging infrastructure, install third-party monitoring, or create external API usage.
- GitHub Actions may be disabled or restricted by repository/organization settings; confirm billing and usage controls before enabling additional workloads.
- Do not introduce secrets into CI. The build uses no production credentials.

## Checks
1. Node 22 + lockfile-based `npm ci`.
2. Execute `npm run test:bd` and record actual test counts.
3. Execute `npm run lint` and `npx tsc --noEmit`; document any pre-existing failures before fixing.
4. Execute `npm run build` with the BD demo explicitly disabled.
5. Manual preview QA: existing recruitment routes; BD disabled when flag unset; admin-only synthetic demo when flag enabled.
6. Read-only schema inventory before drafting reversible Supabase migrations.

## Release gates
- G0: CI jobs pass; manual smoke checks and backup/rollback evidence documented.
- G1: RLS, privileged objects, and roles tested in an isolated environment using synthetic identities; reviewed migration and rollback available.
- G2: BD persistent records pass authorized CRUD, isolation, data-integrity, and recruitment-handoff tests.
- G3: Recruitment workflows pass role and regression tests.
- G4: Reports reconcile to approved sample records; finance rules independently validated.
- G5: AI data handling, cost controls, and human approval for external communications verified.

## Explicit exclusions
No production deployment, database SQL, live environment variable edits, emails, WhatsApp sends, or new paid services. Opening a draft pull request does not authorize merging.

## Baseline observations
The merged BD Phase 1 is a synthetic in-memory demo behind `VITE_ENABLE_BD_DEMO`. A Vercel READY build is not evidence that automated tests or browser acceptance checks passed.

## Evidence register (2026-11-09)
- Automated run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42569971265 — three jobs concluded success. Business Development model tests: 21/21 passed; build passed; TypeScript passed after route generation. Repository-wide lint was non-blocking and retains an existing backlog; this is **not** a lint-clean certification.
- User-confirmed manual live CRM check: user stated “CRM records verified” after reviewing the CRM. This confirms a user-observed smoke test, **not** independent browser automation or a complete end-to-end test suite.
- Production baseline observed: Vercel READY deployment associated with merge commit `c735292fbace6605d691a68b602a02b2c6f9e137`. Phase 0 branch deployments are preview-only.
- Rollback verification: **PENDING**. No rollback action has been executed; no verified database restore evidence.
- G0 overall: **OPEN** until rollback evidence, preview acceptance and lint-backlog disposition are documented.

## No-cost rollback review checklist (read-only)
1. Identify the current Vercel production deployment ID, commit and assigned domains; capture its deployment details.
2. Identify at least one previous known-good deployment and its commit; confirm it is available for redeployment or rollback in the existing Hobby plan **without executing a change**.
3. Document whether rollback controls are available under the account plan; do not assume a paid feature is included.
4. Separately verify the existing Supabase backup/export and restoration capabilities for the current free plan. Never assume point-in-time recovery, automated backups or isolated staging are available.
5. Draft an incident rollback procedure covering code, environment variables and database migrations; do not run production rollback or test destructive SQL on live data.
6. If a safe no-cost database restore rehearsal cannot be completed, record G0 as blocked and avoid production schema changes.
