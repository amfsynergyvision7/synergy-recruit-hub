# CRM filter change bulk selection safety — verified 2026-11-10

GitHub Actions run #290: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42696454259

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` clears bulk selection when the search query changes, an individual column filter changes, or the user clears all column filters. This prevents previously selected records that have become hidden by a changed filter from remaining silently selected for bulk edits or deletions. Existing refresh-based selected-ID reconciliation remains.

New source regression tests in `security/build2/crud-filter-selection-safety.test.mjs` cover all three filter/search interactions.

**Limits:** these are UI safeguards, not server authorization controls. Database RLS, restricted grants, and verified mutation outcomes remain required. Role-based browser testing, staging migration/rollback, and management approval are still outstanding. PR #11 remains unmerged, production unchanged, all nine release gates false.
