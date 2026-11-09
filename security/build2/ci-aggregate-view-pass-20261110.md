# Aggregate-view isolation — verified CI evidence

Recorded: 2026-11-10.

GitHub Actions run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42681849324

Tested commit: `f48a1cbab69b2f7acf9acbcc881eb226ae84aabf`.

Both jobs succeeded: `offline-security-tests` and `isolated-postgres-view-rls`.

PostgreSQL logs confirm:
- `PASS: synthetic security-invoker view and column grants respect recruiter RLS`
- `PASS: synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC`
- `PASS: synthetic invoker aggregate view respects recruiter RLS and billing grant denial`

Scope: synthetic recruiter A/B aggregates under RLS; missing identity returns zero aggregate groups; anon view SELECT denied; salary projection denied to ordinary authenticated role. **This is not the actual recruiter_performance or vw_billing_filters definition.** Actual 13-view compatibility, all 19 table policies, 16 SECURITY DEFINER function bodies, app regression and rollback remain unverified. No production changes. All nine release gates remain blocked.
