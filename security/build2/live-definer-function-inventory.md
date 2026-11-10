# Live SECURITY DEFINER RPC exposure inventory — 2026-11-09
Read-only PostgreSQL catalog inspection. No CRM business rows or function bodies executed.

All **16** listed `public` SECURITY DEFINER functions have effective `EXECUTE` permission for both `anon` and `authenticated`. Their execution privileges must be evaluated against actual function bodies and trigger/scheduler dependencies. This is an exposure finding, **not proof of successful unauthorized invocation**.

| Function signature | Function search_path |
| --- | --- |
| `generate_reminders()` | public |
| `get_user_role(_user_id uuid)` | public |
| `handle_new_user()` | public |
| `has_role(_user_id uuid, _role app_role)` | public |
| `is_approved(_user_id uuid)` | public |
| `on_candidate_stage_change()` | public |
| `on_interview_change()` | public |
| `on_offer_change()` | public |
| `on_submission_insert()` | public |
| `resolve_candidate_uuid(_value text)` | public |
| `resolve_client_uuid(_value text)` | public |
| `resolve_job_uuid(_value text)` | public |
| `rls_auto_enable()` | pg_catalog |
| `run_workflow_rules()` | public |
| `set_assigned_recruiter()` | unset |
| `track_stage_changes()` | unset |

## Critical review groups
- **Potentially callable RPC:** `get_user_role`, `has_role`, `is_approved`, `resolve_candidate_uuid`, `resolve_client_uuid`, `resolve_job_uuid`, `generate_reminders`, `run_workflow_rules`. Review arguments, returned information, privilege bypass and scheduling behavior.
- **Trigger-only functions:** `handle_new_user`, `on_candidate_stage_change`, `on_interview_change`, `on_offer_change`, `on_submission_insert`, `set_assigned_recruiter`, `track_stage_changes`, and possibly `rls_auto_enable`. Confirm actual trigger definitions. Trigger functions cannot normally be called as ordinary SQL functions but exposed EXECUTE remains poor privilege hygiene.
- **Search path:** `set_assigned_recruiter` and `track_stage_changes` have no explicit `search_path`. Other functions mostly use `public` and should be reviewed for schema-qualification and search-path safety. Changing search_path can break unqualified type/table/function references, so inspect bodies first.

## Release checklist
1. Record each function definition, owner, grants, direct API callers and trigger dependencies.
2. For each, decide whether anon/authenticated EXECUTE is essential; explicitly revoke from `PUBLIC` and/or roles only after verifying inherited grants and dependencies.
3. Do not blanket-revoke `has_role` or `is_approved` until all RLS policies are verified; those helpers may be evaluated under end-user roles.
4. Confirm direct RPC calls cannot cause writes, access arbitrary user roles or expose private identifiers without authorization.
5. Use narrowly authorized non-exposed helper schemas for new SECURITY DEFINER functions, with fixed trusted search_path and identity checks.
6. Test via synthetic identities and API role impersonation on isolated free PostgreSQL before production rollout.

**Status:** catalog verified, privilege changes not applied, no charges.
