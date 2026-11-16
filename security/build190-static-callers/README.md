# Build190 — read-only Git caller inventory for security-release compatibility

**Review-only · no hosted SQL, no source mutation, no deployment, no independent acceptance claimed.**

## Material release question

Build187–189 showed that `public.has_role(uuid,public.app_role)` can be made caller-bound in disposable PostgreSQL, signed-JWT PostgREST and real-GoTrue-issued JWT test environments. The *production* policy catalog shows **41 production RLS policy references** to this function, all passing `auth.uid()`. However, **direct server-side code and other audit writers** could bypass those policies or rely on the original helper's ability to query another user's role. Closing the actual compatibility gap requires source inventory across both the currently deployed `main` tree and the larger unmerged integration branch—not another isolated fixture.

## Deterministic offline scan

The [static caller inventory](./source-inventory.mjs) uses **read-only Git commands** to scan two pinned repository snapshots: `main` at `c735292fbace6605d691a68b602a02b2c6f9e137`, and `security/build34-guarded-sync-review-20261111` at `b2734b14c0e19d2ce2b8daa87655ca18c2d932d6`. GitHub Actions fetches those refs with `contents: read`, fails closed on a changed head, and scans application TypeScript/JavaScript and SQL migration sources. It records file/line identifiers without printing secret values, personal records, or unrelated source contents.

The scan enumerates `has_role` references, direct `.from('user_roles')` and `.from('audit_logs')` API calls, all `user_roles`/`audit_logs` source mentions, named trusted email reconciliation references and likely dynamic `.rpc(variable)` call sites. Results are sorted, reproducible and stored as CI-local JSON with a GitHub Actions job summary.

**Scope limitations:** It is not a complete behavioral audit; literal/static patterns may miss wrappers, aliases, generated code, dynamically constructed SQL, external Zapier/CRM connectors, deployed Edge Functions not in this repository, uncommitted code, actual RLS behavior, HTTP authentication, user-role records, audit writers outside repository or permissions at runtime. Migration definitions are not evidence of functions deployed to production. The search intentionally does not read any business/audit tables or execute any application code. Findings need qualified DBA and CRM owner adjudication before changing grants or helper semantics.

## Acceptance and owner handover

A security reviewer should inspect every flagged role-helper/direct membership access and distinguish legitimate server-side administrative operations from caller-identity-bound RPCs, then reconcile the audit writer locations with the **currently drafted** least-privilege `audit_logs` grant proposal and append-only service writer expectation. A zero static direct-call match does **not** justify a blanket revoke or runtime compatibility assertion.

**Required evidence remains:** independently approved API/RLS role matrix, actual hosted fictional-record GoTrue/Auth UAT, confirmed backend/service/cron/external callers, DBA-reviewed backup/PITR restore and rollback, safe audit event producer validation, source review and protected `main`, independent PR signoffs. The Build190 inventory complements, rather than replaces, these gates.

The current live production audit-table grants (anon, authenticated, service_role **8/8** effective privileges), universal PUBLIC ALL policy and missing trusted email reconciliation RPC have not been remediated. **Project formally remains 26/100, 12/43 accepted, 31 outstanding; Category C is 6/10.** No extra accepted milestone is generated merely by inventory creation.

Related [critical audit issue #19](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/19), [role helper issue #26](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/26), and [release executive issue #14](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14).
