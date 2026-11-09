# Main-branch compatibility delta — read-only review 2026-11-10

Comparison: `security/build2-rls-ai-design-20261109...main` (reverse direction). GitHub reports **27 main-only commits** and **99 security-branch-only commits** at inspection; eight files changed in the main-only delta: `docs/bd-phase1-release-checklist.md`, `docs/bd-phase1-synthetic.md`, `docs/bd-review-and-release-gates.md`, `package.json`, `src/components/AppSidebar.tsx`, `src/lib/bd-demo-model.ts`, `src/routes/_app.bd.tsx`, `tests/bd-demo-model.test.mjs`.

Read-only file review confirms the newer Business Development route:
- Uses a `VITE_ENABLE_BD_DEMO === 'true'` feature flag and checks `role === 'admin'` for its demonstration UI.
- Stores synthetic organizations, contacts, opportunities and tasks in React session state, with explicit warning that there is no Supabase connection and no external emails.
- Adds an admin-only sidebar entry when the demo flag is enabled.
- Adds `npm run test:bd` script for synthetic model tests.
- Its own release checklist requires full build, lint, typecheck and browser verification and prohibits production release absent explicit authorization.

**Security implication:** this observed demo route does not currently require a new production BD database policy, and must remain synthetic and disabled by default. Its client-side admin/feature checks are NOT server-side authorization for any future persistent BD feature. Do not add BD production table grants or CRM integrations based on this prototype.

**Reconciliation plan:** preserve all eight main-only changes when later reconciling branches; do not overwrite `package.json` or `AppSidebar.tsx` with older versions. Run `npm run test:bd`, Node Build 2 tests, lint, typecheck, build and browser demo checks on a combined isolated checkout. No reconciliation/merge was performed because deployment-trigger and conflict checks are pending.

**Scope limit:** file-delta and source inspection are not a successful combined build or proof of full runtime compatibility. The security branch remains unmerged; production unchanged.
