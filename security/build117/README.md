# Build 117 — safe CRM search and candidate-specific resume state

## Code and tests

- `src/lib/safe-global-search.ts`: bounded 2–80-character allowlisted name/phone/email fragments; eliminates PostgREST `OR`-grammar tokens, `ILIKE` wildcard expansion, overlong requests and control characters. Every fixed column predicate wraps the pattern in quoted PostgREST filter syntax. This code does not grant access to any table and relies on server-side RLS.
- `src/components/GlobalSearch.tsx`: 250 ms debounce, three six-row queries, cancellation of in-flight Supabase PostgREST reads on close/change/unmount, query-tagged visible results, and generic error rendering without exposing raw provider errors.
- `src/components/ResumeSummaryButton.tsx`: candidate ID and exact resume URL key the preview, preventing extracted resume text from a previously viewed candidate or replaced resume from persisting. Closing the dialog also hides extracted text and resets the mutation preview.
- `security/build117/search-and-resume-isolation.test.mjs`: six new no-secret regression tests cover names/email, rejected filter grammar and wildcards, per-scope fixed columns and quoting, abort/race controls, no stale visible result and candidate-specific resume dialog state.
- Fast and guarded PR workflows now trigger on all of these source paths, and fast CI actually runs all six tests.

## Critical boundaries

This is draft code under release HOLD. Search still requires approved profile, authorization and proper RLS to be safe; front-end query validation is defense-in-depth. The new expression grammar deliberately rejects underscores, percent signs, commas, parentheses, quotes, slash and long searches rather than attempting to interpret them. Operators and database modifications were not changed.

Neither PR #12 nor PR #15 may be self-approved, merged, deployed or permitted to bypass signed hosted UAT. PR #15 remains unchanged for independent review.
