# Build 119 — React Query private-cache isolation and safe root errors

## Implemented

- A shared QueryClient persists for the lifetime of the SPA; previously its private query and mutation cache could survive logout and account changes, even though the private CRM JSX subtree remounted. Build119 adds a pure cache-owner fence with a synchronous QueryClient.clear() invocation on account identity transitions.
- src/hooks/use-auth.tsx clears the cache before rendering a different Supabase subject, clears on local sign-out before awaiting the remote Auth result, and forcibly clears on the same user's role/profile refresh. Repeat same-subject token refresh events do not unnecessarily purge caches.
- src/routes/__root.tsx no longer logs or renders raw thrown Error.message, which might disclose applicant PII or internal endpoints. It shows a fixed, non-revealing fallback with retry.
- security/build119/private-query-cache-fence.test.mjs adds seven direct tests: A→B→A, token refresh, forced same-account role refresh, sign-out, malformed identity, AuthProvider ordering and safe error boundary.
- The no-secret fast CI now runs the seven tests; both fast and guarded workflows trigger on all security-sensitive changes.

## Limits

Query cache clearing is browser-only defense-in-depth; it does not replace Postgres RLS, signed-user server checks or cancellation of every possible imperative fetch. Existing in-flight callbacks must still enforce identity freshness, and PR #12 remains draft under release hold. PR #15 stays unchanged for eligible independent review. No database writes, email, finance activation, merge or production deployment.
