# CI evidence — PostgreSQL synthetic RLS and offline contract tests

Date recorded: 2026-11-10. GitHub Actions run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42680190114

Head commit: `cc660f4d2f5d31002c6b8b4e67f4ca58c4df61c7`.
Workflow conclusion: **success**.
- `offline-security-tests`: **success**.
- `isolated-postgres-view-rls`: **success**.
- PostgreSQL log includes `UPDATE 1` and `PASS: synthetic security-invoker view and column grants respect recruiter RLS`.

The disposable PostgreSQL 17 job exercises a synthetic security-invoker view, recruiter-scoped SELECT, column-level UPDATE grant, and anonymous privilege checks. It does **not** run the proposed 19-table production migration, prove the 13 real views are secure, validate the 16 privileged functions, establish application compatibility, or rehearse rollback.

**Release evidence remains unchanged: all nine conditions blocked.** No production DDL or CRM row reads occurred. CI success is a limited test milestone, not release authorization.
