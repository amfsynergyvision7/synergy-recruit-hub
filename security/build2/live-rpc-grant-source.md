# Verified live RPC grant source — 2026-11-09
Read-only `pg_proc.proacl` inspection; no function executed.

| Function | PUBLIC EXECUTE | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
| --- | --- | --- | --- | --- |
| generate_reminders() | yes | yes | yes | yes |
| get_user_role(uuid) | yes | yes | yes | yes |
| has_role(uuid, app_role) | yes | yes | yes | yes |
| is_approved(uuid) | yes | yes | yes | yes |
| resolve_candidate_uuid(text) | no explicit PUBLIC | yes | yes | yes |
| resolve_client_uuid(text) | no explicit PUBLIC | yes | yes | yes |
| resolve_job_uuid(text) | no explicit PUBLIC | yes | yes | yes |

The first four have explicit `=X/postgres` ACL entries, meaning **PUBLIC EXECUTE**. Revoking EXECUTE only from `anon` is insufficient for these functions while `PUBLIC` grants remain.

## Proposed sequence — not executed
1. Map every direct frontend RPC, trigger and scheduled invocation; identify legitimate anonymous callers and internal authorization helper dependencies.
2. Prepare least-privilege `REVOKE EXECUTE ... FROM PUBLIC, anon` for functions confirmed not to need anonymous execution. For the four with PUBLIC grants, account for inherited grants explicitly.
3. Preserve authenticated execution of `has_role`/`is_approved` while their use in RLS is required; redesign arbitrary user-id access separately.
4. Restrict reminder generation to verified scheduling principal. Confirm schedule ownership and regression tests before revoking privileges.
5. Verify effective permissions with `has_function_privilege` as anon and authenticated after a tested migration; verify rollback and business workflows.

This inventory is evidence of broad grants, **not evidence of exploit or proof of unauthenticated business data access**. Production unchanged.
