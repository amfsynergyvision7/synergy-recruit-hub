# Build189 — GoTrue-issued JWT → PostgREST → caller-bound role helper

**DRAFT / DISPOSABLE TEST ONLY / DO NOT APPLY OR DEPLOY.**

## What this adds beyond Build188

Build188 proved 25/25 JWT HTTP/RPC/RLS cases using *synthetically HMAC-signed tokens*. Build189 goes one level further: its isolated test runner starts a **disposable** PostgreSQL 17 database, Supabase **GoTrue v2.197.0**, and PostgREST v12.2.3 from pinned container tags, on loopback in GitHub Actions. GoTrue actually signs up four fictional users, accepts their test password logins, and **issues access JWTs**. These are then passed through PostgREST to the **exact unchanged Build187 DO-NOT-APPLY `public.has_role(uuid,public.app_role)` proposal**. The 26 HTTP checks cover users with admin, recruiter, finance and no role; own role truth, foreign-user role false, RLS row reads, anonymous/invalid-token denial, and no direct access to the role-membership table.

Only the ephemeral PostgreSQL service contains `auth.users` and `public.user_roles` records. The fictional `@example.com` accounts are auto-confirmed locally by GoTrue; no email delivery, actual hosted accounts, candidates, contacts, CRM, Stripe/finance or production records are involved. The disposable GoTrue base schema is byte-identical to the existing Build42 source snapshot (Git blob `27058f2f2c3f91552686a02cea3e9110132bb0cd`). All containers and database service are discarded after CI. **Do not execute any Build189 bootstrap against a connected or hosted Supabase environment.**

## Source and reproducibility

- [GoTrue base schema](./gotrue-auth-base-schema.disposable.sql) — same source as previously tested Build42
- [Application role/RLS fixture](./app-bootstrap.disposable.sql) — creates fictional roles, applies the reviewed Build187 helper **only in the disposable PG17 service**
- [Loopback-only runner](./run_gotrue_role_rpc.sh) — starts GoTrue and PostgREST after migrations
- [26 HTTP scenarios](./gotrue-issued-role-rpc.test.mjs) — uses actual GoTrue signup/password exchange tokens and asserts role/RLS isolation

## What this does NOT establish

A passing Build189 check is not a test in any connected Supabase project or your deployed application; it does not test production JWT key rotation, real users, all 41 production RLS policies, actual backend callers, service-role behavior, email reconciliation, audit writers, application business flows, migration rollback in hosted infrastructure, branch protection or release signoff. An independently authorized **hosted** fictional-account UAT and qualified DBA/Privacy/CRM review remain required.

**Critical live hold remains:** production `public.audit_logs` broad effective privileges, permissive PUBLIC ALL policy, missing trusted email reconciliation, current publicly callable SECURITY DEFINER helper, unprotected `main`, unreviewed PRs and Category C LD02/LD05 (6/10). Programme 26/100, 12/43 milestones formally accepted, 31 open. This engineering test alone earns **zero** formal milestone points.

The draft function is not a migration or a license to perform production permission changes. [Review issue #26](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/26) · [Critical audit issue #19](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/19).
