# Authorization-helper CI evidence — 2026-11-10

GitHub Actions: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42682704587

Tested commit: `7a068894086f2a5fab002c917746c0c516b22759`. Workflow run #56 completed with **success**; both the offline-security-tests and isolated-postgres-view-rls jobs succeeded.

PostgreSQL job log reports:
- PASS: synthetic security-invoker view and column grants respect recruiter RLS
- PASS: synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC
- PASS: synthetic invoker aggregate view respects recruiter RLS and billing grant denial
- PASS: live-column-shaped candidate view denies cross-recruiter, inactive and missing-identity reads
- PASS: synthetic live helper predicates and self-scoped RPC deny pending, inactive, anonymous and arbitrary-ID access

The new fixture reproduces verified `is_approved` and `has_role` predicates on synthetic profiles and roles, and tests a **proposed** self-scoped RPC with restricted grants. It does not deploy or change the live functions, and is not proof of actual CRM caller compatibility. No production rows accessed; no production changes. All nine release gates remain blocked.
