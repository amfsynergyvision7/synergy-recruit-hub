# CRM normalized update diff — verified 2026-11-10

GitHub Actions run #265: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42694882907

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` now normalizes stored empty string/undefined to null for change detection, compares numeric form values to numerically equivalent stored values, and uses strict equality for other field types. This replaces `String(oldValue) !== String(v)`, which could misidentify null/blank changes and conflate unlike types. The existing changed-columns-only update behavior remains.

New static tests `security/build2/crud-normalized-diff.test.mjs` assert normalization and comparison safeguards. The earlier `crud-column-grant-compatibility.test.mjs` contract was updated to recognize the new comparison, after run #263 surfaced an outdated assertion. Run #265 passed.

**Limitations:** static source assertions and synthetic database checks do not establish production correctness for every field type. Staging role-based browser tests, complete-schema rollback rehearsal and management approval remain required. PR #11 remains unmerged, no production changes, and all nine release gates remain false.
