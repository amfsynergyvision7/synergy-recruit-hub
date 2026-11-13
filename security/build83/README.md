# Build 83 — Fail-closed candidate sync and restricted duplicate scanning

**13 November 2026 | AMF Synergy Vision | GitHub draft PR #12 | RELEASE HOLD**

This build implements server-side security changes to prevent unapproved candidate synchronization and hidden integration writes. It does **not** deploy, merge, publish, send messages, contact candidates, process resumes with AI, import real records, enable billing or access Auth Admin credentials.

## Concrete changes committed on the draft branch

### 1. Non-overridable scheduled and manual candidate-sync holds
- `src/lib/external-effects-hold.server.ts` now defines **eight** constant-true release holds: the six Build82 holds plus `candidate_sync` and `integration_configuration`. No environment or browser flag bypasses them.
- `src/lib/integrations.functions.ts`: manual `triggerSync` checks `candidate_sync` **before** approved admin verification, deployment feature flags, or creating a database-backed lease.
- `src/routes/api/public/hooks/sheets-sync.ts`: the authenticated Vercel cron handler receives an unavailable `enabled` value whenever the source-level `candidate_sync` release hold is in effect. Even setting `SHEETS_SYNC_CRON_ENABLED=true` cannot start live synchronization via this endpoint.
- `src/lib/sheets-sync.server.ts`: the low-level exported `runCandidateSync` itself checks the same hard hold before lease/account checks or the candidate-writing implementation, so direct server callers cannot skip the route hold. Existing full-history and non-atomic write restrictions remain intact.

### 2. Integration settings GET is genuinely read-only
- `getIntegration` now requests `getSavedGoogleIntegration({backfillLegacy:false,...})`, so an ordinary settings read cannot perform a surprise legacy database backfill through a privileged service-role client.
- `getSavedGoogleIntegration` defaults to **no backfill**; Build96 now **rejects every explicit legacy-backfill request when no owner-scoped row exists**, rather than allowing an ownerless `integrations` row to be silently rehomed. The low-level settings save now opens or creates only its own `google_integrations.user_id` record.
- Manual `saveIntegration` and `detectHeaders`, low-level `saveGoogleIntegrationSettings`, `saveDetectedHeaders`, and `fetchSheetValues` require the same hard release interlock before writing configuration or accessing an external Google Sheet. Existing admin-role checks remain.
- These holds block premature auto-sync enablement and sheet-data downloads via the revised application while preserving read-only settings and sync-log viewing for approved admins.

### 3. Candidate privacy and failure handling
- `src/lib/duplicates.functions.ts`: the duplicate finder previously accepted **any signed-in CRM session** and scanned up to 5,000 candidate records with personal contact fields. It now requires `assertApprovedRole(context.userId, ["admin"])` before the scan (approved, active and exactly one role), in addition to the signed-user middleware and RLS.
- `src/lib/sheets-sync.server.ts` no longer includes untrusted upstream error bodies in `result.error_details`, `sync_logs` or `google_integrations.last_error` for a failed synchronization. The log catch also avoids serializing the original provider exception.
- `security/build83/sync-configuration-and-duplicate-privacy.test.mjs` adds nine automated checks for hard-held runtime actions, configuration read/write boundaries, cron env override, direct sync denial, sanitized errors and duplicate-scan administrator enforcement.
- The previous Build82 hold-count regression assertion was extended from six to eight; both existing fast and guarded CI now include Build83 tests and file triggers.

## Evidence and completion boundaries

**Fast CI: 247/247 tests passed** at initial Build83 source SHA `73830c907e4b36788e1b588574a354763c461f68`, run [43377205360](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43377205360).

Full guarded CI for the final documentation commit must be separately verified; it includes application compile/typecheck and disposable PostgreSQL17 source-shaped 38-row/135-RLS integration from Build81. The deliberate production-release-hold job must remain failing. A successful fast test or in-memory role model does **not** constitute signed hosted acceptance.

**Not executed:** No Supabase nonproduction Auth users, app fixture rows or RLS policies have been provisioned by this build. No staging/production SQL writes, no external API calls through the application, no CRM sync, no mailing, no workflow financial activation, no GitHub `main` merge and no independent release signoff.

**Latest previously verified production security baseline:** 67 legacy public policies, 19 anonymous TRUNCATE table grants and 13 public non-invoker views. Zero of 48 production remediations accepted. `main` remains unprotected and draft PR #12 has zero independent reviews.

## Critical path to merge and full programme completion

1. Approved protected server-side Auth Admin execution to provision nine isolated invalid-domain GoTrue test accounts in dedicated nonproduction; the connected Supabase tool does not expose a safe Auth Admin `createUser` action or the needed secret.
2. Execute and verify the prepared 8+8+2 base and 20 remaining fictional fixture rows (38 total) in that isolated project, then independent approval and hosted installation of the reviewed 15-read-policy RLS model.
3. Run **135 real GoTrue-signed HTTP read cases** and five separately controlled write cases, plus view, API, browser, ownership/PII and recovery evidence. All formal hosted signed UAT still **0/140**.
4. Obtain independent code review, protect `main`, prove PITR/restore, close privacy/HR/legal/finance controls, formally sign all nine release gates, stage and accept the 48 production security remediations and authorize a controlled merge/deployment.
5. Extend programme closure beyond recruitment CRM: company knowledge, prospect research, marketing, sales outreach, recruitment automation and business intelligence workstreams require their own approved evidence.

**Formal counters:** 0/48 production remediations accepted; 0/140 signed hosted UAT; 0/9 release gates; 0/6 programme workstreams formally closed. They are **not** reset or advanced by CI-only tests.

**Conditional planning estimate:** approximately **5–10+ further substantive CRM release builds to `main`**, and **15–30+ builds for all six programme workstreams**, **if** protected Auth Admin access and independent reviews/signoffs become available. With those blockers unresolved, no finite build count is reliable.

Source of record: [draft PR #12](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12), [hosted UAT issue #13](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13), [governance issue #14](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14). No real candidate or client records are included here.

## Build 96 — Block ownerless historical Google Sheets connection transfer (13 Nov 2026)

**Source risk identified through read-only production schema metadata:** `public.integrations` has no `user_id`, whereas `public.google_integrations` has a required `user_id`. The older `getSavedGoogleIntegration({backfillLegacy:true,userId:...})` path took the one available global legacy `candidates` Sheets integration and created an owner-scoped record under whichever administrator happened to call `saveGoogleIntegrationSettings`. This could transfer sheet URLs, integration configuration and historical auto-sync settings across accounts after the current release holds are independently lifted. No real sheet contents, credentials or candidate records were queried to establish this defect.

**Implemented draft-only:** an existing owner-scoped `google_integrations` record is still read normally; a missing record now returns `null` for read-only requests. Asking for `backfillLegacy:true` when there is no owner-scoped record fails with a generic independently reviewed owner-mapping requirement; **no global `integrations` query or implicit service-role `upsert` exists in this read path**. New authorized integration saves use `backfillLegacy:false` and the authenticated administrator's explicit `context.userId` from the server route. The existing hard-coded `integration_configuration` and `candidate_sync` release holds remain **active**.

The updated Build83 regression test checks no ownerless table lookup, no global->user transfer, no hidden upsert and an approved-admin-protected save. Old legacy integrations, if business-required, need a future separately reviewed, auditable migration with a verified owner mapping and consent—not inference from the current session.

**Boundaries:** This is source-only hardening on draft PR #12. It does not migrate any real connection, enable sync, access sheet data, create new hosted UAT accounts, change production, merge or deploy. Formal release counters remain 0/140 signed hosted UAT, 0/48 accepted remediations and 0/9 independent release approvals.


## Build 97 — close raw sync error/legacy diagnostics leak (13 November 2026)

**Source-only privacy hardening in draft PR #12; no CRM/Supabase writes, Google Sheets reads, external sends or activation.** A review of `src/lib/sheets-sync.server.ts` found that, although the outer sync error handler returned a generic message, the lower-level row catch still persisted raw `e.message` (or `String(e)`) into `error_details`, `google_integrations.last_error` and `sync_logs.errors`. Those values could contain Google Sheet URLs, candidate cells, private provider diagnostics or tokens. The approved-admin integration screen also displayed historical raw error messages from `sync_logs`, and logged a saved spreadsheet URL plus diagnostics to the browser console. The eight hard-coded external-effects holds are still active, but this would be unsafe if they were later independently released.

**Changes:** the per-row catch stores only `SAFE_CANDIDATE_SYNC_ERROR` with the bounded row index, never a provider exception. Database error formatting in the integration settings path no longer interpolates messages/details/hints/codes. Header mapping and history-read errors use static messages. The server transforms existing/legacy sync-log records through `sanitizeStoredSyncLogs`, allowing only bounded counters, safe status, non-sensitive category labels and **redacted error text** before any browser response. Malformed or oversized historical error lists are rejected rather than silently reported as zero errors. The integration UI removes saved URL/diagnostics console logging, raw server-error console logging and raw error toasts. Existing approved role checks, integration ownership constraints and all sync release holds remain enforced.

**Tests:** Build83's fast regression suite now injects fictional but sensitive-looking candidate emails, spreadsheet links and bearer strings into legacy log rows and asserts none survives `JSON.stringify` of the server-safe result. It also checks that complete row error counts and harmless aggregate counters are preserved, malformed data fails closed and no raw backend fields are passed through. Source assertions cover both the internal row catch and the integration-screen error/console paths. These tests are offline and should not be mistaken for hosted signed UAT acceptance.

**Release requirements remain:** hosted 0/140 signed tests, 0/48 accepted production remediations, 0/9 formal approvals, no independent PR #12 review, GitHub `main` unprotected. Keep the draft and its intentional `production-release-hold` in place. The current PR #15 preview/reviewer workflow is separate and unchanged by this build.
