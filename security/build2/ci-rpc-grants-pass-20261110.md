# Synthetic RPC grant test — verified CI evidence

Date recorded: 2026-11-10.

- Run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42681585767
- Tested commit: `54f288306f6b0612f4b75e8e74757daa4be3163c`.
- `offline-security-tests`: **success**.
- `isolated-postgres-view-rls`: **success**.
- PostgreSQL log: `PASS: synthetic security-invoker view and column grants respect recruiter RLS`.
- PostgreSQL log: `PASS: synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC`.

The disposable PostgreSQL fixture demonstrates that default PUBLIC EXECUTE grants must be revoked to block anonymous function calls, and confirms selective authenticated EXECUTE and internal-job denial. It does not execute the 16 real CRM SECURITY DEFINER functions, test their function bodies, or establish application caller compatibility.

No production SQL, release-evidence.json changes, merge, or deployment. All nine production release conditions remain blocked.
