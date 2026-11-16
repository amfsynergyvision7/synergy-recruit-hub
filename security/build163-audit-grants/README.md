# Build 163 — Complete PostgreSQL 17 audit-table grants (REVIEW ONLY)

**DO NOT APPLY SQL / MERGE / DEPLOY / SEND EMAIL / PROVISION AUTH.** These are source-only changes to dependent draft PR #18, not a production or staging migration.

Production read-only PostgreSQL catalog revealed that anonymous, authenticated and service roles additionally retain `REFERENCES`, `TRIGGER`, and `MAINTAIN` grants on `public.audit_logs`. Earlier Build161/162 code and tests validated SELECT/INSERT/UPDATE/DELETE/TRUNCATE but did not revoke these three privileges. PostgreSQL 17 defines all of them. The table is owned by `postgres`; RLS is enabled but not forced, the `service_role` has BYPASSRLS, and the reviewed admin reader is exactly `has_role(auth.uid(), 'admin'::app_role)`.

## Source-only changes
- Extend the review-only lockdown with `REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public.audit_logs FROM PUBLIC,anon,authenticated,service_role`. The original vetted grants and approved admin SELECT policy remain untouched in the proposal. The postgres owner/break-glass model remains open to independent review.
- Extend the read-only `audit-integrity.preflight.readonly.sql` to check all extra effective grants (nine new role×privilege flags) and pin the exact admin read policy expression, not a permissive keyword substring. Any privilege/policy drift yields release HOLD.
- Create a metadata-only `audit-grant-matrix.readonly.sql` reporting effective permissions, explicit ACL grantees, table ownership/RLS flags, role BYPASSRLS flags and exact reader-policy match. No audit rows, candidate data or routine bodies.
- Recreate the previously overlooked rights in disposable PostgreSQL 17 fixture and verify proposed lockdown removes all of them before role-switch tests. Add seven tests, wired into focused no-secret GitHub Actions. No hosted mutations.

## Risk boundaries and required acceptance
RLS does not govern TRUNCATE or REFERENCES and ordinary ACL changes cannot constrain the owning role or a superuser; a database audit trail is not WORM storage. PostgreSQL documentation: https://www.postgresql.org/docs/17/ddl-priv.html and https://www.postgresql.org/docs/17/ddl-rowsecurity.html.

Qualified DB/security owners must first evaluate live Data API reachability, current grant paths, consumer services and provider integrations, owner access, backup/PITR, and the full 48-object/67-to-35 PR #16 migration. Validate real approved admin reader and append-only event writes with isolated hosted UAT, then independently authorize staged remediation. Until then do not apply SQL. All SMTP, reconciliation and financial release holds remain active. 0/48 production security objects, 0/140 hosted signed tests, 0/9 release signoffs; weighted release readiness remains 26/100 until actual acceptance.
