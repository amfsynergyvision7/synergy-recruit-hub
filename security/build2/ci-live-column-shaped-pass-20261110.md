# CRM-column-shaped RLS fixture — verified CI evidence

Recorded 2026-11-10. Run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42682131097

Commit tested: `076d94ea807d628b27e3bcb3a387ea852942b59d`.

Both jobs passed: `offline-security-tests` and `isolated-postgres-view-rls`.

PostgreSQL log confirms:
- `PASS: synthetic security-invoker view and column grants respect recruiter RLS`
- `PASS: synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC`
- `PASS: synthetic invoker aggregate view respects recruiter RLS and billing grant denial`
- `PASS: live-column-shaped candidate view denies cross-recruiter, inactive and missing-identity reads`

The latest fixture uses verified production column names/types for a **reduced** candidates/profiles/billing reproduction. It checks recruiter A visibility, cross-recruiter exclusion, inactive profile exclusion, missing identity exclusion and lack of billing view SELECT grants.

It is **not** an actual-schema clone, does not reproduce full production enums, constraints, triggers, all 19 table policies, 13 view definitions or 16 SECURITY DEFINER function bodies. No actual business records were accessed. All nine release conditions remain blocked. Production unchanged.
