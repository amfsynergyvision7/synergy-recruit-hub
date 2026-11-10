# Existing repository schema-source candidate — read-only inventory

**Status: CANDIDATE ONLY / NOT APPROVED / NOT PROVEN COMPLETE.** No database access or changes were performed for this inventory.

The `main` branch of `amfsynergyvision7/synergy-recruit-hub` contains **26 SQL migration files** under `supabase/migrations/`, spanning 2026-05-12 to 2026-09-30. These tracked migrations are a possible starting point for a disposable synthetic reconstruction, not an independently verified snapshot of the current production schema.

## Critical limitations
- Migration history may omit manual SQL changes, grants, default privileges, role memberships, extension configuration, non-public schemas, and deployment-specific differences.
- No migration replay or schema equivalence has been claimed here; file presence does not prove replay order, idempotence or compatibility.
- Some migration definitions may reference external Supabase auth/storage objects or policies and require carefully isolated fixture stubs. Do not copy business rows, secrets or live JWTs.
- The approved complete schema-only source and designated reviewer remain outstanding. Compare any replay result against an independently authorized read-only catalog export before claiming parity.

## Next authorized preparation
1. Review the 26 files as **source code only**, identify dependencies, unsupported constructs, security-definer routines and potentially irreversible DDL.
2. Build a disposable-only migration replay plan and synthetic fixtures with no network or production connections.
3. Require independent source authorization and equivalence evidence before executing the 140 role outcomes or changing release-gate status.

All nine release gates remain false; no merge, deployment, staging/production writes or financial activation.
