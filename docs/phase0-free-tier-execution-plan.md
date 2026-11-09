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
