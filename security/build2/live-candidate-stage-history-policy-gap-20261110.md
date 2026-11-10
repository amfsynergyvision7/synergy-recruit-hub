# Candidate stage-history permissions — verified catalog triage 2026-11-10

Authorized read-only `information_schema` and `pg_policies` inspection (no business rows):

- Columns: `id uuid NOT NULL`, `candidate_id uuid NULL`, `previous_stage text NULL`, `new_stage text NOT NULL`, `changed_by uuid NULL`, `notes text NULL`, `created_at timestamptz NULL`.
- **Zero rows** returned from `pg_policies` for `public.candidate_stage_history` (no table RLS policies).
- `information_schema.role_table_grants` reports both `anon` and `authenticated` granted SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES on the table. As prior catalog review confirmed RLS is enabled, the absence of policies normally denies regular direct row access despite these grants; do not misstate that a grant alone proves data exposure. Table owners, bypass-RLS roles and privileged triggers/functions require separate review.

**Review-only least-privilege design:** revoke anonymous grants and nonessential authenticated TRUNCATE/DELETE/UPDATE/TRIGGER/REFERENCES. Grant authenticated SELECT only if needed, with a policy relating `candidate_id` to a candidate assigned to the approved active recruiter or approved admin; account for `candidate_id IS NULL` as deny. Stage-history INSERT should be through a trusted audited trigger/service principal, not arbitrary authenticated inserts; protect `changed_by` and `notes` from impersonation or tampering. Preserve actual trigger dependencies and backfill behavior. No live DDL executed.

**Compatibility blockers:** identify trigger(s) that write history and their effective role; determine if admins/recruiters need direct read and how existing UI queries history. Test both legitimate stage transition and unauthorized direct write with synthetic records before proposing a deployable policy.

Production unchanged, all nine release gates blocked.
