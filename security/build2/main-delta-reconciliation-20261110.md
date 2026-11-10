# Current main delta — reconciliation reconnaissance (2026-11-10)
Status: review-only; no merge.

GitHub comparison of `security/build2-step35e-integration-draft-20261110` to `main` reports 27 commits on main not in the draft integration branch, and the reverse comparison reports 259 draft-branch commits not in main after the acceptance-register commit.

Main-only changed paths (eight):
1. `docs/bd-phase1-release-checklist.md` — added
2. `docs/bd-phase1-synthetic.md` — added
3. `docs/bd-review-and-release-gates.md` — added
4. `package.json` — modified
5. `src/components/AppSidebar.tsx` — modified
6. `src/lib/bd-demo-model.ts` — added
7. `src/routes/_app.bd.tsx` — added
8. `tests/bd-demo-model.test.mjs` — added

## Risk and reconciliation constraints
- `package.json` and `src/components/AppSidebar.tsx` have changes on the draft security line too: **manual semantic reconciliation is required**. No blind tree overlay or claim of zero conflicts.
- Preserve the existing BD prototype's explicit demo-only status. Do not activate production BD workflows or add persistence.
- Check routing compatibility between `_app.bd.tsx`, `_app.tsx`, generated route tree and approval checks.
- Keep all Step 35E AI/SMTP hard-denial and server authorization protections.
- Compare lockfile/dependency versions and CI script behavior before integrating package changes.
- Test BD synthetic model and route navigation alongside Build 2 and Step 35E tests on a **new isolated draft branch**; no main merge or deploy.

This closes main-only **path discovery**, not semantic reconciliation, branch integration or release acceptance.
