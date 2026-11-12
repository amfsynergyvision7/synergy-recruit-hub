# Build58 — Four source-exact mutable search_path functions (REVIEW ONLY)

Supabase's read-only live security advisor currently reports four public functions with mutable search_path: `set_assigned_recruiter()`, `track_stage_changes()` (both SECURITY DEFINER) and `get_recruiter_stats(date,date)`, `search_candidates(text)` (SECURITY INVOKER). The current live catalog says all four have anonymous EXECUTE grants, although the effective data visibility may be restricted by RLS, and trigger helpers cannot be called successfully without a trigger invocation context.

`live-function-preflight.sql` has catalog MD5 `ea5005b2208a2d0891e3f8004fd7de80`. `function-search-path-review-only.sql` refuses altered function definitions, sets the search path to `pg_catalog,public`, revokes PUBLIC/anon direct EXECUTE for all four and restricts signed-in direct calls to read-only stats and candidate search. The trigger helpers retain automatic trigger invocation and their direct SQL execution is revoked for client roles.

`exact-four-function-replay.integration.sql` stores the four real live function bodies retrieved READ-ONLY; synthetic profiles/candidates exercise recruiter assignment, stage tracking, search, stats and anonymous denial, with total rollback. It is not hosted Auth UAT, not installed in production and may affect custom consumers requiring independent compatibility review.
