# Live authorization helper verification and draft policy risk — 2026-11-10

Read-only production catalog inspection of `pg_get_functiondef` for `public.is_approved(uuid)` and `public.has_role(uuid, public.app_role)`; no CRM rows queried and no functions invoked.

## Verified helper semantics

- `is_approved(_user_id)` returns true only when a matching `public.profiles` row has `status='approved'` **and** `is_active=true`.
- `has_role(_user_id,_role)` checks a matching `public.user_roles` row for the supplied role.
- Both are `STABLE SECURITY DEFINER`, with `search_path` set to `public`.
- The `is_approved` check is stricter than a status-only predicate, and can exclude inactive approved users. This is verified function-definition behavior, **not** a live row-level test.

## Open security and compatibility issues

1. These functions accept arbitrary UUIDs and currently have effective anonymous execution according to the previous privilege inventory. Their bodies do not bind `_user_id` to `auth.uid()`. An authenticated/anonymous caller may be able to infer approval or role status for known identifiers. Treat as an information-disclosure design risk; verify actual RPC exposure without touching candidate records.
2. RLS policies rely on these functions. Any EXECUTE restriction or function redesign must preserve evaluation for legitimate authenticated policy checks, including pending/inactive denial.
3. `search_path='public'` is set but is not the hardened `pg_catalog,public`/empty trusted search path pattern; assess unqualified references and function ownership before changing it.
4. The review-only 15-table policy replacement does not cover the other four tables; the 13 views and 16 SECURITY DEFINER functions require coordinated migration and rollback.
5. No production deployment is authorized. The nine release gates remain blocked.

## Proposed next isolated tests

Reproduce the actual helper bodies in disposable PostgreSQL with approved, pending and inactive synthetic users. Verify both normal policy evaluation and denied arbitrary-UUID lookup after an authorized redesign. Test caller compatibility before touching production grants.
