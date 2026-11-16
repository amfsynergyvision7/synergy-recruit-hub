# Build186 — role-helper RLS dependency and exposure review

**16 November 2026 · No hosted writes · SECURITY REVIEW HOLD · Not release approval**

## New, source-pinned live catalog results

Connected project metadata was inspected using SELECT-only PostgreSQL catalogs. Neither `has_role` nor any email/CRM function was invoked; no user, role-assignment, candidate, contact, billing, audit-log or business-event rows were read.

| Evidence | Production | Isolated nonproduction |
|---|---:|---:|
| PostgreSQL policy objects across all schemas | 73 | 92 |
| Policies with text referencing `has_role(...)` | **41** | **38** |
| Other routines with a static `has_role(...)` reference | 0 | 0 |
| `public.has_role(uuid,public.app_role)` exists | Yes | No |
| `SECURITY DEFINER` | Yes | Not applicable |
| Helper `search_path` | `public` | Not applicable |
| Anonymous EXECUTE | Allowed | Not applicable |
| Authenticated EXECUTE | Allowed | Not applicable |

Nonproduction's 38 textual dependencies are in a **separate source-shaped lab schema** and are not evidence that the production `public.has_role` helper is installed there. Production's helper body reads `public.user_roles` with a caller-supplied user UUID and role. The role facts above are catalog configuration, **not proof of remote reachability, data disclosure or exploitation**. The separate Supabase security advisor identifies exposed SECURITY DEFINER functions as a warning class.

The 41 production policy references affect several business areas, including audit, billing, application settings, CRM ownership, roles, candidate/job/opportunity records, integrations, sync and storage. **Blindly REVOKING anonymous/helper permissions, changing schema search_path, changing function ownership, or replacing the function may affect legitimate business policy execution.** Independently review the actual uses and role-access tests first.

## Work packaged for security/DBA decision

1. Re-run the exact [catalog dependency query](./role-helper-impact.readonly.sql) and compare policy names/roles with owner-approved access matrix; independently classify `anon` and `authenticated` runtime needs.
2. Separately inspect the current SQL function, ownership, schema grants, executable permissions, and the implications of a caller-supplied user UUID/role; document whether role existence can be inferred through an exposed RPC.
3. Propose a least-privilege redesign **only after** inventorying dependent RLS policies and API calls; evaluate non-exposed authorized helper patterns, safe role binding, and how real JWT identities must be checked. Do not automatically change all 41 policies.
4. Test exact role scenarios with synthetic data in a separately authorized, access-controlled hosted environment; ensure legitimate staff still see only permitted CRM and audit records, and unauthorized principals cannot enumerate other users' roles.
5. Attach DBA/privacy/CRM independent review, PITR backup/restore/rollback proof, compatibility signoff and protected-main reviews before scheduling any live change.

## Source-code change in same draft PR

The separate proposed PG17 metadata-only audit release checker now requires a narrowed `public.has_role(uuid,public.app_role)` helper, explicitly empty function search path, trusted owner, authenticated EXECUTE, no anonymous EXECUTE and schema USAGE. Four PostgreSQL17 rollback-scoped negative test cases refuse unsafe configurations. **This is a necessary review-only catalog condition, not proof that any actual helper authorizes safely or that the proposed remediation is deployable.**

**Unchanged hard stops:** Production `audit_logs` broad privileges and public ALL policy remain unsafe; the named reconciliation RPC is absent. Category C **6/10** (LD02 and LD05 independent acceptance missing). Project **26/100**, **12/43 accepted**, **31 open**. No main merge, production deployment, live sourcing, outreach, CRM/DB writes, approved release signatures or independent PR approval generated.
