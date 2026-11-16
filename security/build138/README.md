# Build 138 — Integration browser interlocks and least-data admin sync-log evidence

**Scope:** Draft PR #12 only. No SQL or Auth writes, candidate-stage changes, Google Sheets network sync, outbound email, branding publication, protected merge, Vercel deployment, or financial activation. Source hardening is not hosted Auth/UAT or production security signoff.

## Previous build evidence actually verified

Build137 exact source SHA `ea1fa45428935b3307d09435c6cd3dab807a3364`:
- [Fast CI 43596679181](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43596679181): 896/896 offline plus 11/11 independent candidate/finance hold cases = 907/907 passed, application build and TypeScript succeeded.
- [Guarded CI 43596679219](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43596679219): **36/37 jobs passed**. Sole failure was the deliberately red `production-release-hold`. All substantive guarded jobs passed.
- Historical fixed acceptance: 26/100, 12 of 43 accepted; PR #12 draft, PR #15 open, independent submitted PR reviews zero.

## Actual Build138 work

1. **Stop misleading editable Sheets UI:** `src/lib/release-safety.ts` now exports unconditional, code-pinned `CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED` and `CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED`. They mirror existing *independent* server-side `CRM_INTEGRATION_CONFIGURATION_RELEASE_HOLD` and `CRM_CANDIDATE_SYNC_RELEASE_HOLD`. They cannot be enabled via client environment variables.
2. **Enforce the hold before any server method:** `src/routes/_app.integrations.tsx` explicitly checks the corresponding hold at the start of the save, detectHeaders and triggerSync mutation callbacks—before `ensureSaved` or RPC calls. Sheet URL, sheet-tab name, header row and column mapping inputs are disabled. Detect/save buttons are disabled; automatic, manual and full-history sync remain inactive.
3. **Keep safe administrator reads:** the page is still rendered only after an exact active approved administrator account check; account/role changes remount its private workspace. Existing getIntegration and 50-run read-only history/refresh remain available. `src/lib/integrations.functions.ts` server release checks are unchanged.
4. **Reduce privileged log retrieval:** `getCandidateSyncLogs` now reads only the exact ten required `sync_logs` columns, not `select("*")`. Raw provider response fields, old exception messages, spreadsheet metadata and future unapproved columns are not read. The historical `errors` JSON is still retrieved only to be redacted **server-side** through `sanitizeStoredSyncLogs` before returning to the browser. Queries are stable newest-first with ID tie-break and maximum 50 rows, described as a *preview*, not a complete history.
5. **Prevent browser PII leakage:** the integration page no longer displays `diagnostics.fetchedSheetUrl` or raw `l.errors[].message`; it renders the configured/unavailable state and generic error-detail notice instead. Malformed/failed/unfinished history responses cannot display a false "No sync runs yet" claim; they show a visibly unavailable or verifying state. Legacy logs without valid identifiers receive stable local fallback row keys only for display.
6. **Contracts:** `security/build138/integration-release-readonly.test.mjs` exercises three distinct pause paths, exact administrator gate, disabled controls, server-interlock ordering, narrow SELECT projections, redacted synthetic provider errors, no false empty history, and no direct candidate DML. The established Build129 sync-pause UI statement was preserved when the first fast test found a wording compatibility assertion; no old controls were re-enabled. `security/build138/scorecard-progression.test.mjs` holds the 43-gate acceptance score to 26/100. Historical Build137 acceptance frozen in `security/release-progress/build137-evidence-baseline.json`.

## Live isolated nonproduction security readback — read only

Project `dhlhlasnaapzckjyvffn` observed `ACTIVE_HEALTHY`: 19/19 public tables with RLS enabled, 0 public RLS policies, 0 real Auth users, 0 enabled public application triggers. Separate SELECT count queries across **each of all 19 public tables** returned **exact 0 rows**, not only estimated catalog cardinality. No table, policy, user, grant, function, storage or trigger was modified.

The previous exact-function nonprod parity gap remains: 7 privileged security-definer functions in this isolated test lab versus 16 names in a historical production-review reference; nine *lab-only absences* are cataloged in `security/build137/nonprod-auth-parity-review.json` and `security/build136/read-only-lab-object-evidence.json`. No claim that these are missing from current production.

## Release blockers and specific independent owners

| Gate | Read-only evidence | Required next actor |
|---|---|---|
| Branch protection | `main` unprotected, zero rulesets | GitHub repository admin must enforce independent PR review, required substantive CI, prevent force pushes/bypass |
| Focused Auth bootstrap | [PR #15](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) open/unmerged, latest head CI passed, independent reviews 0 | Independent reviewer and admin must approve exact source SHA and protected merge |
| Environment | `amf-nonprod-auth-review` GitHub Environment protection/secrets **not verifiable through current connector** | Environment owner must verify independent reviewer enforcement and test-project-only secrets; do not paste secrets into source/chat |
| Hosted Auth/UAT | 0/9 real fictional Auth users; 0/38 inert fixture records; signed UAT 0/140 | After reviewed isolated lab function/policy parity, manually gated AUDIT_ONLY, then approved synthetic setup and signed role tests |
| Production privileges | 0/48 separately accepted production object remediations | Security/DB owner audits actual current production tables/views/privileged functions; isolated lab is not production |
| Financial/legal/ops release | 0/9 release signatures, rollback/PITR signoff pending | Independent operational, security, HR, finance and privacy/legal release owners |
| Deployment | Vercel exact-head previews repeatedly return build-rate-limit | Vercel account/CI owner decides quota resolution or approved alternate build path, only after protected main |

**Fixed formal progress:** 26/100; 12/43 accepted, 31 open, 74 points unearned; protected-merge readiness 0/8. This build **does not self-close any signed milestone**. More source commits cannot substitute for a genuine external reviewer or repository administrator setting.

**Estimated further milestone-closing builds:** about 16–31 if 1–2 independent milestones begin closing per build, optimistic 11 at 3. With independent approval and hosted testing blocked, there is no credible finite countdown based on code commits alone. Small PR #15 and protected main are the next measurable unblockers.

## Exact-head verification protocol

Only the **final** Build138 commit fast workflow and guarded workflow count. The fast suite must pass offline tests, 11 standalone candidate/finance safety checks, real Vite build and TypeScript. Guarded should pass every substantive job, with **sole intentional failure `production-release-hold`**. An intermediate fast green result is not final-head acceptance. The previous targeted fast run of integration fixes passed 909/909 offline cases, 11/11 safety checks plus build+typecheck; final state must be separately checked.

No merge/deploy/production DB write, customer outreach or financial activation occurred in this build.
