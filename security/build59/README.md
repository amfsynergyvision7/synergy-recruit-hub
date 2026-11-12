# Build59 — All 13 live definer-view ACLs: source drift, DML-only lockdown (REVIEW ONLY)

Production SELECT-only catalog reports **13 privileged-owner non-invoker views**. Every one has anonymous SELECT privileges and authenticated view DML privileges (the existence of grants does NOT prove successful writes; base-table ACL and RLS also apply). Source SQL checksum is **a90d4a1fab9552d47697127888e10d19**. No private CRM row was inspected. This is a *genuine* remaining attack surface; Build49 already proposes `security_invoker=true` and revokes anon reads but does not explicitly remove authenticated/service view DML grants.

New source `13-view-write-acl-review-only.sql` checks exact source SQL, refuses any unfamiliar definition, requires all 13 views already marked `security_invoker=true` and anonymous SELECT revoked. It revokes ALL inherited/explicit view table privileges and all per-column INSERT/UPDATE/REFERENCES grants from PUBLIC and API roles, then restores **SELECT only** to authenticated and service_role. It checks postflight that no API view DML remains, while existing row-level policies still govern base-table access. This is NOT an active migration and may break existing clients using updatable views; Finance/Recruitment reviewers must accept compatible read paths.

`full-policy-view-cases.sql` adds a real PostgreSQL role matrix: 13×3 privilege checks, anonymous candidate/billing view denial, recruiter-own scoped candidate view and inactive recruiter denial. The entire suite is injected into the existing one-BEGIN/one-ROLLBACK release review; do **NOT** count these synthetic roles as 140 genuine hosted GoTrue acceptance cases.

Security note: `security_invoker` can make an existing view start returning permission errors if base-table grants are missing. This is correct fail-closed security; browser consumers must be reconciled before release.

Official docs: https://supabase.com/docs/guides/database/views (security_invoker), https://supabase.com/docs/guides/database/postgres/row-level-security (grant/RLS relationship).
