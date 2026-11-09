# Batch 05 candidate activity insertion — blocked investigation (2026-11-09)

Status: **FAILED / NOT ACCEPTED**. Isolated synthetic Supabase only; all experiments ran in BEGIN/ROLLBACK. No production changes.

## Evidence
1. Production read-only policy inspection: `public.candidate_activities` still has `Allow all for authenticated` (`FOR ALL USING(true) WITH CHECK(true)`) plus a separate approved-user SELECT policy.
2. First synthetic RLS insertion matrix failed with `permission denied for table batch05_candidates`: the INSERT policy subquery referenced a candidate table without authenticated SELECT privilege.
3. Second synthetic variant used a SECURITY DEFINER lookup function, but the test's cross-owner INSERT assertion failed (`cross-owner permitted`). **Do not use or deploy this variant.**
4. A subsequent direct function-only isolated probe showed `own=true` and `cross=false`. This does **not** resolve the discrepancy with the RLS INSERT test.

## Required next work
- Inspect RLS INSERT evaluation and authenticated-role context in separate statements, including `auth.uid()` and function input values.
- Avoid adding SECURITY DEFINER to paper over missing SELECT permissions. Prefer an appropriately scoped candidate SELECT policy and invoker evaluation, then rerun role tests.
- Verify both allowed and denied INSERTs, recruiter identity spoofing, cross-owner activity, pending user and finance denial, administrator behavior.
- Compare with production trigger/constraint dependencies in read-only mode.
- Commit a passing fixture only after repeatable verified results.

**Release gate: SEC-06 candidate activities INSERT remains open.**
