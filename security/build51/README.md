# Build 51 — Candidate Stage RPC (Review Only)

**Status: DRAFT, NO HOSTED MIGRATION, NO RELEASE AUTHORIZATION**

## Concrete changes
- Proposed `crm_change_candidate_stage(candidate_id, expected_stage, new_stage)`: uses only `auth.uid()` for actor, checks an approved/active admin or the assigned recruiter, locks the candidate row, refuses stale source stage, and inserts a privacy-limited audit log within the same transaction.
- Source SQL revokes the Build48 draft `UPDATE(stage)` grant, retaining the existing notes-only grant. Direct browser stage DML will not bypass this RPC after the proposed full 67-policy migration.
- Dangerous downstream stages (`submitted_to_client`, `interview_scheduled`, `offer_released`, `joined`) are **blocked entirely** by the proposed RPC. Already-joined candidates cannot be moved to a different stage. There is no new billing/invoice policy and no authorization to activate fees.
- CandidateBoard now calls a typed RPC helper instead of a direct table update. Its unconditional Build50 hold remains ON. No user can activate stage changes just by setting a client environment variable.
- CI adds a disposable PostgreSQL 17 role-test and an actual trigger that would create a billing row if a joined stage were ever reached. Tests assert no billing, correct audit, atomic failure rollback, stale write rejection and unauthorized-role denial. Synthetic JWT claim settings only: not formal hosted UAT.

## Remaining prerequisites
1. independently approved workflow state-machine and finance/legal policy, including side-effecting stages
2. deployable, drift-checked composition with full 67-to-35 RLS and all 48 ACL objects; test full trigger/function dependencies and lock ordering
3. real GoTrue-issued signed hosted-user browser/API checks and the full 140-case historical acceptance
4. candidate create/edit/delete, duplicates and CSV import still paused, as they require separately audited server write commands
5. secure backup/restore and roll-forward rehearsal, independent review, protected main, nine signed release gates

**No changes to hosted production or nonproduction databases, and no change to `main`.**
