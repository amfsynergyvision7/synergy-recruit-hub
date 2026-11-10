# Workflow automation privilege dependency — verified 2026-11-09

## Read-only catalog findings
- `public.workflow_rules`: RLS enabled, effective table SELECT/UPDATE grants to both `anon` and `authenticated` (table-level privileges alone do not establish row access).
- Its **only** RLS policy is `admin manage workflow rules`, `FOR ALL TO authenticated`, `USING has_role(auth.uid(),'admin')`, `WITH CHECK has_role(auth.uid(),'admin')`.
- **Gap:** unlike `is_approved`, `has_role` only checks role membership. An inactive, suspended or rejected user retaining an admin role may still satisfy this workflow-rules policy. This is a policy-design vulnerability contingent on role retention; no user rows were inspected.
- `public.candidate_stage_history`: RLS enabled; effective anon/authenticated SELECT grants and authenticated UPDATE grant, but **no RLS policies** currently exist for this table. Ordinary API roles should be denied by RLS unless other bypasses apply. Verify application history reads.
- `run_workflow_rules()` is a SECURITY DEFINER trigger that reads `workflow_rules` and may dynamically UPDATE the source table based on the rule. Restricting workflow-rule edits is especially important.
- `track_stage_changes()` writes `candidate_stage_history` using an unqualified relation name with unset search_path.

## Remediation design, review-only
1. Replace the workflow-rules policy's `has_role`-only predicate with `public.is_approved(auth.uid()) AND public.has_role(auth.uid(),'admin')` in both USING and WITH CHECK, **after** validating administrator rule-management workflows and role/approval lifecycle.
2. Ensure only authorized admins can modify workflow rules; enforce a server-side allowlist of permitted `table_name` and `update_field_name`, not merely quoted identifiers. `format('%I',...)` prevents SQL identifier injection but does not enforce business authorization on which field may be changed.
3. Set a trusted search_path and qualify `public.candidate_stage_history` in `track_stage_changes` after checking trigger dependencies.
4. Test inactive-admin denial, recruiter denial, anonymous denial, allowed-admin rule edits, stage-history creation, workflow trigger recursion, and permitted field transitions using synthetic records on isolated PostgreSQL.
5. Confirm no historical dashboard depends on direct authenticated SELECT from `candidate_stage_history`; if needed, add ownership-scoped SELECT policy instead of universal access.

**Production:** unchanged. **Release status:** blocked pending integration tests.
