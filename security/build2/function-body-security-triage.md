# Function-body security triage — 2026-11-09
Source: live `pg_get_functiondef` metadata, read-only; no CRM data rows queried and no functions invoked.

## Confirmed findings
1. **`public.get_user_role(_user_id uuid)`** is SECURITY DEFINER and currently effectively executable by `anon`. It returns a role for an arbitrary supplied UUID, with no `auth.uid()` or caller approval check. **Potential role enumeration / information disclosure.** Priority high.
2. **`public.resolve_candidate_uuid(_value text)`** is SECURITY DEFINER and effectively executable by `anon`. It looks up candidate IDs by UUID, candidate code, email, or full name, with no caller authorization check. **Potential candidate existence/identifier disclosure.** Priority high.
3. **`public.resolve_client_uuid(_value text)`** similarly resolves client IDs by UUID, company name or email without caller authorization. Priority high.
4. **`public.resolve_job_uuid(_value text)`** resolves job IDs by UUID or title without caller authorization. Priority high.
5. **`public.generate_reminders()`** is SECURITY DEFINER, returns void, and is effectively executable by `anon`. Its body inserts notifications using candidate, interview, offer and billing data. Although it has an ON CONFLICT deduplication guard, unauthorized invocation can still trigger business-side effects. Priority high.
6. **`public.run_workflow_rules()`** is a trigger-returning function, not an ordinary RPC. It dynamically updates fields based on `workflow_rules` and uses a recursion guard. Review workflow_rules edit permissions and trigger invocations before release.
7. **`public.set_assigned_recruiter()`** and **`public.track_stage_changes()`** have unset search_path. The latter inserts into unqualified `candidate_stage_history`, increasing the importance of a fixed trusted search_path.
8. `public.has_role` and `public.is_approved` are SECURITY DEFINER authorization helpers. Their bodies query `user_roles` and `profiles` respectively. Keep these available to RLS evaluation until an alternative is tested; do not blanket revoke.

## Safe remediation design — not executed
- First inspect frontend RPC callers, triggers, cron jobs and database dependencies.
- For user/role and entity resolvers, replace arbitrary-identity lookups with authorized self-scoped or admin-scoped interfaces; return minimal fields. Where internal triggers require privileged lookups, use non-exposed helper functions and explicit grants.
- Remove effective `anon` EXECUTE from direct RPCs after caller compatibility testing; note `REVOKE ... FROM anon` alone is insufficient when `PUBLIC` grants are inherited.
- Restrict `generate_reminders` to the verified scheduled/service principal, and test scheduled execution before changing grants.
- Fix function search paths only after verifying unqualified references and dependency behavior.
- Test denied anonymous RPC calls, pending/inactive users, cross-recruiter lookups, admin flows and scheduled reminders with synthetic records in isolated PostgreSQL.
- Audit `workflow_rules` table access, because its values influence privileged dynamic updates.
- Maintain production unchanged until a tested migration and rollback are available.

**Not completed:** actual grant revocations, function replacements, integration tests or production deployment. These must not be represented as done.
