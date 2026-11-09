# Offer candidate asynchronous lookup race protection — verified 2026-11-10

GitHub Actions run #335: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42699600949

All three jobs succeeded: application build/TypeScript, offline security tests, isolated PostgreSQL.

Draft `src/components/CrudModule.tsx` applies direct form edits immediately using functional state updates, guards asynchronous offer candidate lookups with a sequence counter, and merges lookup results into current form state only if the candidate still matches. New form openings and effect cleanup invalidate pending lookup responses. Interview/submission query errors are surfaced to users.

Static regression test: `security/build2/crud-offer-candidate-lookup-race.test.mjs`. Updated cleanup assertions in existing regression tests; run #333 initially failed an outdated static assertion, corrected before successful run #335.

**Limits:** static tests and CI are not browser-based race tests. Existing candidate-related values already populated in a form are not automatically cleared on candidate changes; this needs product-rule validation before modifying. No staging/production changes, no merge or external communications. PR #11 remains unmerged; all nine production release gates remain false.
