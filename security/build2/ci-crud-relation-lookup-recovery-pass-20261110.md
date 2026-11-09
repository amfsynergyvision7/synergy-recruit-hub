# CRM relation lookup stale response and failure recovery — verified 2026-11-10

GitHub Actions run #325: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42698738395

All three CI jobs succeeded: application build/TypeScript, offline security tests, and isolated PostgreSQL checks.

Draft `src/components/CrudModule.tsx` adds a relation lookup sequence guard. Only the latest relation lookup may replace relation options or display an error. Cleanup invalidates pending lookup responses, as well as existing row refresh requests. Failed Supabase relation queries now raise a user-visible warning instead of being silently substituted with empty options. Existing options are preserved on failed lookup.

Static regression coverage: `security/build2/crud-relation-lookup-recovery.test.mjs`. Updated `security/build2/crud-refresh-ordering-and-selection.test.mjs` to assert cleanup invalidates both request types. CI runs #320 and #321 initially failed an outdated test assertion; fixed before successful run #325.

**Limitations:** relation dropdown results remain limited to 500 rows; pagination/search and role-based browser tests remain to be addressed. No staging or production changes, merge, deployment or external communications. PR #11 unmerged; all nine release gates false.
