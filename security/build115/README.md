# Build 115 — account-switch authorization race hardening

This is **review-only** CRM client code on PR #12; it does not alter a database policy or approve a release.

- `src/hooks/use-auth.tsx` invalidates all previous role/profile requests whenever Supabase emits a new session, the user requests a refresh, the user signs out, or the React provider unmounts.
- `src/lib/auth-identity-epoch.ts` exposes a small pure epoch guard, with exact signed-in subject matching and fail-closed role derivation. A role is not exposed for a pending, suspended, rejected, inactive, missing, or mismatched profile.
- `security/build115/auth-identity-epoch.test.mjs` covers account A → B → A, refresh of one account, sign-out/unmount, bad profile/role data, callback ordering and observable source invariants.
- `.github/workflows/security-build65-fast.yml` now executes the six actual Build 115 tests, and both workflows include the changed auth paths on pull requests.

**Known boundaries:** Existing server-side `assertApprovedRole` checks and PostgreSQL RLS remain authoritative; front-end role hiding alone is not a security boundary. This does not approve PR #12, PR #15, hosted UAT, financial workflows or deployment. No candidate records or secrets are read by the tests.
