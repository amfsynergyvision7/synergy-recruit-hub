# Disposable migration replay — consolidated review checklist

**DRAFT / NOT EXECUTED / NOT APPROVED.** Generated manifest: `node security/build2/migration-replay-manifest.mjs supabase/migrations`.

## Phase 1 — source and dependency review
- Freeze the 26 migration paths, file SHA-256 digests and ordered manifest digest. Verify every file is tracked in the intended repository revision.
- Review external `auth` and `storage` schema references, required extensions, SQL privileges and role memberships. Fixture stubs must not be mistaken for actual Supabase service behavior.
- Review SECURITY DEFINER routines and `search_path`, dynamic SQL, triggers, destructive DDL and financial workflow references. Require separate explicit approval before any financial policy changes.
- Confirm all SQL is restricted to a throwaway PostgreSQL 17 service with synthetic identities and rows. No production connection strings, credentials or remote database access.

## Phase 2 — disposable-only replay (not yet performed)
- Provision a fresh isolated PostgreSQL service; validate the host/database name and synthetic fixture credentials.
- Install only reviewed prerequisite schemas, extensions and minimal synthetic `auth.users` fixtures; record every deviation from the approved source.
- Apply migrations in filename order, one by one with fail-fast logging. Stop on the first error; never skip a failed migration to claim success.
- Export the nine-section catalog fingerprint, record object counts and replay log references. Do not include private row data.
- Recreate a second disposable instance from the same reviewed manifest and compare catalogs; perform backup/restore and rollback rehearsal.

## Phase 3 — independent equivalence and authorization
- Compare the disposable schema against an **independently approved read-only schema-only source**. Repository migrations alone cannot prove production parity.
- Verify non-public schemas, role memberships, default privileges, ownership and extensions separately; the nine-section `public` exporter is not exhaustive.
- Only after source approval and independent review may the seven-role 140-case synthetic authorization execution be considered. The matrix currently contains provisional expectations; resolve management-sensitive cases first.

## Reporting
Do not label static preflight or manifest generation as migration replay. Do not claim schema equivalence or release readiness until evidence supports it. All nine production release gates remain false; no staging/production writes, merge, deployment or financial activation.

## Verified source dependency and targeted fixture
- The initial repository migration `20260512131020_8bd78994-f2ec-4e2b-a8f1-6838de651c80.sql` references `auth.users` through foreign keys and attaches an authentication-user trigger. This is an observed source dependency, not proof of successful full migration replay.
- `synthetic-auth-dependency.integration.sql` exercises a separate synthetic user/profile foreign-key contract, denial of orphan profiles, cascading deletion and transaction rollback on disposable PostgreSQL. It deliberately uses `build2_auth_fixture`, not the actual Supabase `auth` schema, and **does not execute any repository migration or activate financial triggers**.
- Full migration replay remains blocked on reviewed Supabase authentication/storage dependencies, source authority and safe handling of financial side effects. The targeted fixture cannot establish equivalence.
