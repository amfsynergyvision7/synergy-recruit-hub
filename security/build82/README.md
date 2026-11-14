# Build 82 — server-only release interlocks and record-bound outbound actions

**13 November 2026 | AMF Synergy Vision | Draft PR #12 | DO NOT MERGE OR DEPLOY**

## Implemented in actual draft-branch application code

Build 82 closed concrete gaps in existing server functions. Previous client-facing release-hold constants protected some legacy browser mutations but did **not** comprehensively protect callable server-side SMTP, public application, interview scheduling, and career-publication functions. A role check in email and scheduling also trusted *any* matching role without requiring an approved/active profile or a unique role membership. Those paths are now explicitly contained.

1. **Non-toggleable server-side release interlock** — `src/lib/external-effects-hold.server.ts` defines six hard true constants and one fail-closed assertion for `crm_email`, `interview_scheduling`, `public_application`, `careers_publication`, `candidate_ai_processing`, and `drive_bulk_import`. No `process.env` or browser flag can turn them off. Approval to remove a hold must be reviewed in source, following real signed hosted UAT, independent legal/privacy/operational approvals as relevant and a controlled deployment.
2. **SMTP and email authorization** — `src/lib/email.functions.ts` checks hard hold *before* any server action; replaces permissive `.some(role)` with `assertApprovedRole` (approved, active, **exactly one** allowed membership); uses this same gate for email history and merge context. Before a future approved send, the selected candidate/client must be actually readable through the signed user's Supabase client. `src/lib/crm-email-recipient-policy.ts` ensures requested destination matches that record's stored email; recruiters can address only owned candidate records, administrators can address client contacts, and arbitrary recipients fail closed. `src/lib/email.server.ts` independently prevents all direct SMTP sends while release-hold is true, including direct callers outside the route.
3. **Scheduling and service-role bypass control** — `src/lib/scheduling.functions.ts` checks the hard hold before the authenticated scheduling creation, anonymous scheduling info lookup, or anonymous token-based confirmation. It replaces the old any-role authorization with approved/active/exactly-one-role checks. Future confirmation now uses an **atomic compare-and-set UPDATE** checking `id`, `status='awaiting_candidate'`, and containment of the selected proposed slot, returning a row only if the CAS succeeded. This prevents stale/replayed token requests from overwriting an accepted slot if that workflow is independently released.
4. **Public careers** — `src/lib/careers.functions.ts` refuses public listing/detail queries until publication approval and refuses anonymous candidate creation/submissions until explicit public application authorization. Job detail is additionally filtered by `status='open'` and does not echo raw PostgREST errors if eventually released. Public listing still filters `open` when unpaused.
5. **AI resume privacy and bulk-import safety** — `src/lib/ai.functions.ts` now checks `candidate_ai_processing` before all **five** Gemini/Drive-backed candidate AI/matching/resume-scoring/PDF entrypoints, and checks `drive_bulk_import` before the sixth server-side Drive folder import entrypoint that can create/update candidate rows. All six original server-side approved-role checks are preserved. This prevents premature external candidate-resume processing and accidental bulk CRM writes when the draft application is present in an unapproved environment.
6. **Data protection and secret lifecycle** — `src/lib/sheets-sync.server.ts` no longer interpolates the raw Google Sheets gateway error body into thrown messages where candidate rows/provider diagnostics might appear. `src/lib/email.server.ts` no longer returns raw SMTP exceptions or invalid sender env values, and its cached SMTP transporter now includes a **SHA-256 password fingerprint** so server-side secret rotation invalidates stale warm connections without retaining the raw password in its cache key.

The existing signed-auth middleware and database RLS checks remain defense-in-depth. These hard source holds prevent *new* execution through the revised draft application entrypoints; they do not claim to stop a separately deployed old production version, direct database use, or unrelated third-party services.

## Automated regression checks

The new Build82 test files are:
- `external-effects-release-interlocks.test.mjs` — 6 runtime hard-hold cases plus source contracts for email, scheduling, CAS, public careers, five candidate-AI handlers and Drive import.
- `provider-redaction-and-smtp-rotation.test.mjs` — SMTP hold/error/caching and Sheets gateway error redaction contracts.
- `record-bound-email-recipient.test.mjs` — pure actor-to-record ownership tests (arbitrary recipients, conflicting roles, clients, bad identity and malformed email) and endpoint enforcement ordering.

Both `.github/workflows/security-build65-fast.yml` and `.github/workflows/security-build34-review.yml` now run all Build82 regression tests and retain the Build77–81 source/full PostgreSQL RLS cases and the intentional production release hold.

**First completed fast run** at branch source before the final documentation commit: **235/235 tests PASS**. The full guarded workflow and final HEAD CI are verified separately; do not infer success or UAT acceptance solely from source authoring.

## Actual hosted state and final acceptance boundaries

The only database use in this build is read-only verification. Dedicated nonproduction `dhlhlasnaapzckjyvffn` has **zero** actual GoTrue Auth users, zero loaded fixture rows, zero installed public authorization policies and zero enabled source application triggers, unless a subsequent separately cited readback establishes otherwise. The 38-row full source-shaped PostgreSQL 17 fixture plus 135 read-case suite remains an **independently verified disposable CI test** from Build81, not hosted signed GoTrue/PostgREST UAT.

Production `wusntntcqgtpgokggdzv` still has **67 public legacy RLS policies, 19 anonymous TRUNCATE grants and 13 public non-security-invoker views** on the previous read-only comparison; no production remediation is applied by this source build. `main` remains unmerged and, on latest GitHub branch-API inspection, **unprotected**; PR #12 has no independent reviews. No SMTP messages, client/candidate emails, new job postings, candidate applications, interview confirmations, Google sync, billing, joins, or financial actions were executed or activated by Build82.

**Formal release counters remain unchanged:** **0/48** production security remediations accepted, **0/140** signed hosted UAT cases, **0/9** independent release gates, and **0/6** fully closed programme workstreams.

## Next actual release blockers

Provision nine isolated `example.invalid` GoTrue accounts using a protected nonproduction server-side **Auth Admin** executor (the connected Supabase tool does **not** offer `auth.admin.createUser` or a service-role key; do not insert directly into `auth.users`). Run and verify the staged 8/8/2 and remaining 20 synthetic rows (38 total); independently review and run the proposed 15 read policies in the hosted lab under an approved execution context; execute 135 real signed HTTP reads and five separately controlled writes plus view/browser coverage. Resolve branch protection, independent reviewer signoff, backup/PITR restore proof, HR/legal/privacy/finance authorizations and 48 production remediations before release, `main` merge and deployment.

The number of engineering builds remaining cannot be guaranteed while protected Auth Admin and independent approval prerequisites remain unavailable. **Conditional planning range: about 5–10+ substantive CRM builds to `main` and 15–30+ full-programme builds.** Do not subtract builds just because a code/test stage completed without corresponding signed hosted acceptance.

Evidence: draft PR https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12 ; hosted UAT issue https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13 ; governance issue https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14 .
