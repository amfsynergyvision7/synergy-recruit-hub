# Build188 — Signed JWT → PostgREST RPC → role helper → RLS

**DRAFT AND DISPOSABLE ONLY. DO NOT APPLY TO HOSTED/PRODUCTION DB.**

## Reproducible source bundle

The [bootstrap](./bootstrap.disposable.sql) starts with an isolated PostgreSQL 17 instance in GitHub Actions. It creates only fictional UUIDs, a mocked `auth.uid()` that reads JWT session claims, a deliberately broad *legacy* `has_role` function with service-role EXECUTE, and two synthetic RLS tables. Then it invokes the **exact** [Build187 DO-NOT-APPLY proposal](../build187-role-helper/has-role-current-user.DO-NOT-APPLY.sql.txt) in this throwaway database. The [runner](./run_signed_rpc.sh) launches `postgrest/postgrest:v12.2.3`, following the repository's earlier Build41 synthetic HTTP test pattern, and the [Node tests](./signed-role-rpc.test.mjs) exercise 25 actual HTTP requests through named `/rpc/has_role` and RLS-protected tables.

Tests cover positive authenticated admin/recruiter/finance role checks, subject equality, denial of cross-user role queries, audit/candidate row access, no-role user, missing JWT subject, anonymous RPC/data denial, expired/tampered/malformed JWT, explicit service-role grant with missing end-user session, and denial of direct `user_roles` reads. Only fictional, in-container records and synthetic HS256 JWT test tokens are used; no live user registration, CRM record, email, candidate or external contact is involved.

## Exact limits

A passing outcome **does not prove** real GoTrue-issued JWT identity, hosted Auth access rules, production backend compatibility, production SQL semantics, outbox integrity, backup/restore, independent UAT or approval. This is disposable PostgREST's JWT verification and the proposed SQL running with synthetic roles. No hosted database changes or production deployment are performed.

**Required independent follow-up:** Security/DBA must review source and full dependency graph (including 41 production RLS policies and external service caller paths), assess direct `service_role` behavior, verify a separately authorized real GoTrue/PostgREST test with fictional data and backup/PITR, and approve a coordinated `audit_logs` permission and helper remediation. Protected main, independent PR reviews and release signoffs remain required. Do not merge this draft merely because green tests pass.

**Formal status:** programme 26/100, Category C 6/10, accepted milestones 12/43, 31 open. No acceptance increment from these tests alone.
