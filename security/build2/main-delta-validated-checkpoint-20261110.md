# Main-delta combined security checkpoint — 2026-11-10

**Decision: draft-only integration validation PASSED; production release HOLD.**

## Exact CI evidence
Source SHA: `98dddecde2c9ba1b171647ea5df7bedf7c2b5270`.
- Step 35E GitHub Actions run **42763109949**: SUCCESS.
- Build 2 GitHub Actions run **42763110094**: SUCCESS.
- Build 2 jobs: `application-typescript-check`, `offline-security-tests`, and `isolated-postgres-view-rls` all SUCCESS.
- Application CI includes `node --test tests/bd-*.test.mjs`, covering BD synthetic model and demo guardrail contracts.
- The first BD test failure was an incorrect duplicate ID in the test fixture, not a failed owner authorization check; fixed in `382ea9ea`.

## Reconciliation scope
- Successor isolated branch: `security/build2-step35e-main-delta-draft-20261110`.
- Brought six main-only BD demo source/docs/test paths onto the draft branch.
- Adopted main's BD demo navigation with `VITE_ENABLE_BD_DEMO === "true"` feature flag; route additionally checks admin role.
- Preserved the security branch's `package.json` build command (`npm run test:security && vite build`) and its `test:security` script; main's `test:bd` script is already present.
- Added BD source-contract tests verifying disabled-by-default behavior, role guard, and synthetic-only model.
- **Important:** GitHub still reports 27 commits ahead on main relative to this draft branch due to divergent ancestry. File overlay is not a Git history merge, and this checkpoint does not claim the 27 commits were merged or all semantic effects reviewed.

## Not yet proven
- No browser-based end-to-end checks of role navigation, BD route or core CRM flows.
- No actual current-production-schema-equivalent negative authorization matrix.
- No full fresh metadata inventory or complete approved 15-table migration.
- No verified restore from backup in an isolated environment.
- No Supabase security advisor recheck or independent approval.
- No merge/deploy/staging or production database write/financial activation.

## Required next gates
1. Review remaining main commit ancestry and route/dependency semantics without merging; document any mismatches.
2. Build current-schema-equivalent synthetic role and workflow tests, including column-grant, view, RPC and ownership negative paths.
3. Prepare reviewed reversible migration and run backup/restore on a separate approved synthetic environment.
4. Obtain independent security review, release owner signoff and separate explicit production-change authorization.

**Release remains blocked.** CI success is evidence for draft source only. The nine-condition `release-gate.mjs` intentionally remains fail-closed.
