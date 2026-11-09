# RLS draft schema compatibility check — 2026-11-09

Source: production `information_schema.columns` metadata only. No business rows accessed.

## Verified column types
- `candidates.id` UUID, `candidates.assigned_recruiter` UUID
- `job_openings.id` UUID, `job_openings.assigned_recruiter` UUID
- `submissions.candidate_id` and `submissions.candidate_uuid`: both UUID
- `interviews.candidate_id` and `interviews.candidate_uuid`: both UUID
- `offers.candidate_id` and `offers.candidate_uuid`: both UUID
- `profiles.id` UUID, `profiles.status` `user_status`, `profiles.is_active` boolean
- `user_roles.user_id` UUID, `user_roles.role` `app_role`
- Verified `app_role` labels: `admin`, `recruiter`, `operations`, `finance`, `viewer`.
- Verified `user_status` labels: `pending`, `approved`, `rejected`, `suspended`.

The draft's `coalesce(candidate_uuid,candidate_id)` is type-compatible in submissions/interviews, and its `assigned_recruiter=auth.uid()` comparisons are UUID-compatible. The `finance` role label exists.

**This is a narrow schema check only.** It does not verify SQL execution, grants, trigger interactions, policy correctness, view ownership, UI compatibility or safe deployment. Production unchanged.
