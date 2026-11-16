# Build 128 — Fail-closed shared CRM listings and exact offline spreadsheet review

**Status:** Draft-only source remediation on PR #12. No database migrations, Auth provisioning, new RLS policies, staging/production writes, Vercel deployment, `main` merge, financial activation, AI provider calls, recruitment email or external publishing.

## Baseline

Build 127 exact-head technical evidence: 507/507 fast tests passed; guarded workflow **36/37 jobs passed**, where the only failure was the intentionally enforced `production-release-hold` (verified by requesting the entire 37-job list, not the connector's initial 30-job page). The fixed full-programme acceptance rubric remains **26/100**, 12/43 evidenced, 31 open.

## Material Build 128 work

### A. Corrected offline file-preview validation

- PapaParse can rename duplicate CSV headers. Fail if its `renamedHeaders` map is nonempty, instead of relying only on the already renamed field list.
- SheetJS `sheetRows` adjusts worksheet `!ref`; also inspect `!fullref` (when present) before declaring a file under the 500-row/80-column limit. Reject multiple worksheets rather than silently taking only the first.
- Examine the original Excel header row (`header:1`) before SheetJS creates distinct keys from repeated headers. Validate both case-insensitive and semantic punctuation-normalized duplicate names.
- Reject parser-generated unexpected row keys, non-finite numeric cells, ambiguous numeric strings and impossible/locale-dependent dates. Local date strings must be actual ISO `YYYY-MM-DD` days, including leap year validation.
- Prior 2 MiB / 500-row / 80-column / 16,384-character cell, stale parsing, and no-live-database-read controls remain. This is **offline preview only**; it does not check existing CRM collisions, foreign keys, Auth or recruiter eligibility. All import mutations remain held.

### B. Security-hardening the shared CRM record component

- Wrap `CrudModule` in exact account/profile/role validation. Use a keyed inner workspace to discard one account's local rows, dialog state and selections on switching accounts or roles.
- Apply a conservative **250-row** `count:"exact"` limit to the main list; reject API trimming, mismatched counts, malformed/duplicate IDs, and stale responses rather than showing potentially incomplete exports or business totals.
- Apply the same exact-count and duplicate-ID checks to related-record selectors, with a **250-row** maximum for each. Clear all selector options on failure.
- Cancel pending requests on refresh/unmount; remove unrestricted `postgres_changes` subscriptions. Provide deliberate manual Refresh instead.
- Clear previous sensitive detail/email/form state on refresh and show generic backend error messages in affected mutation paths.
- The shared component still uses `select("*")` for legacy record editing and relation callbacks. **This is not an independently approved role-safe field projection, server RLS policy, or full high-volume pagination implementation.** Those remain release work. Above 250 authorized records, the list intentionally fails closed rather than silently omitting rows.

### C. Verification and governance

- `src/lib/crm-list-integrity.ts`: pure, directly tested exact-count and ID-integrity predicate.
- `src/lib/offline-import-coerce.ts`: pure, directly tested numeric and ISO-date normalization.
- `security/build128/import-parser-integrity.test.mjs`: file ambiguity, missing data and content limitations.
- `security/build128/crud-read-isolation.test.mjs`: account scoping, capped lists, aborts, manual refresh and holds.
- `security/build128/scorecard-progression.test.mjs`: historical evidence, fixed gate invariants and no fabricated acceptance. Build 127 snapshot separately preserved.
- Both fast and guarded CI include Build 128 tests. Their exact final-commit results must be read back; the guarded intentional release-hold job remains in place.

## Latest read-only blocker evidence

- GitHub `main` protection: **false**; repository rulesets: **0**.
- PR #12 draft/unmerged; PR #15 open/unmerged; both had **zero submitted independent reviews**.
- Nonproduction Supabase security lab `dhlhlasnaapzckjyvffn`: **ACTIVE_HEALTHY**, **19/19 public tables RLS-enabled**, **0 Auth users**, **0 public RLS policies**, **0 table rows**.
- Hosted signed UAT **0/140**, accepted production permission fixes **0/48**, nine formal release signoffs **0/9** based on last evidenced baseline.
- Vercel final-head deployment has not been accepted; do not infer deployability from a previous preview or unrelated CI pass.

## Acceptance and release order

1. Repository administrator enables protected `main` with required passing substantive tests, no force-push bypass, resolved conversations and independent reviewer approval; verify live readback.
2. Independent reviewer approves isolated nonproduction Auth PR #15. Repository admin sets the protected lab-only environment, required reviewer and lab-only credential secrets (never production credentials).
3. Only after reviewed control setup, provision nine fictional lab identities and 38 inert records in the isolated nonproduction laboratory. Establish authorized hosted role tests and sign off 140 UAT cases.
4. Independent full-CRM review of draft PR #12, 48 production remediation acceptances, PITR/restore validation, privacy/legal/HR/finance review and nine owner signatures; merge/deploy only when genuinely accepted.

**Fixed programme score:** 26/100; 31 fixed milestones remain open, 74 points unearned. No number of source commits substitutes for formal acceptance.
