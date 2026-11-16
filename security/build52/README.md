# Build 52 — Candidate Create and Detail Update RPC (DRAFT / HOLD)

**No hosted database writes, no merge, no live candidate action, no financial activation.**

## Changes

- Added a proposed `crm_write_candidate(candidate_id, expected_updated_at, fields)` RPC. It derives identity only from `auth.uid()` and validates an active approved administrator or assigned recruiter. Admin assignment is checked against currently approved active recruiters. Recruiters cannot reassign records.
- Inserts always begin at `lead_received` with `created_by` derived server-side. Updates are serialized by `FOR UPDATE` and refused if `updated_at` does not match the client's expected value.
- Exact writable fields are allowlisted. `stage`, `status`, `candidate_code`, `created_by`, `resume_summary`, ATS fields and timestamps cannot be supplied. No financial calculation, email, destructive delete or bulk import is performed.
- Proposed SQL removes **all authenticated direct candidate INSERT/UPDATE/DELETE grants** (including prior notes/stage grant), routing approved writes to separately audited server operations. Execution grants are authenticated-only, with PII-free audit field names in the same transaction.
- Candidate CrudModule's proposed future save path calls this RPC with only changed fields and refuses changes to stage. The Build50 unconditional candidate-write UI hold remains true, so no preview operator can activate it accidentally.
- CI includes a role-scoped PostgreSQL 17 disposable transaction with candidate creation/edit, owner isolation, stale-update denial, field injection denial, approved admin assignment, audit-failure rollback, no billing-trigger side effect, and full `67 original policies → 35 replacement policies` integration. Synthetic JWT values, **not actual GoTrue hosted session acceptance**.

## Unresolved release constraints

- Candidate hard deletes/duplicate cleanup and Excel/CSV import remain paused; their retention, cascading deletes, idempotency, atomic failure recovery and policy approvals are unresolved.
- Side-effecting candidate stages are deliberately blocked by the separate Build51 RPC. Its restrictive SQL must be reconciled with this candidate grant lockdown before any migration.
- UI still paused by default; formal hosted user/browser API UAT required before any activation.
- Actual production objects remediated: 0/48. Historically accepted hosted cases: 0/140. Signed release gates 0/9. Full Command Center workstream closures 0/6. Independent reviewers still absent.
- The proposed `SECURITY DEFINER` implementation must receive independent code review, an exact privileges audit and production-equivalent backup/roll-forward rehearsal. Do not publish or deploy based on CI alone.

## Additional Build52 live-trigger compatibility hardening

- Read-only production audit confirmed the `candidates_updated_at_trigger` uses `now()`, which can return the same timestamp for multiple updates within one SQL transaction. The review-only SQL now installs a candidate-specific AFTER-legacy-order `BEFORE UPDATE` trigger to enforce monotonically increasing `updated_at` values, including the same-transaction case. Standalone fixture recreates the real trigger for regression tests.
- Read-only production audit confirmed the active `run_workflow_rules()` trigger supports privileged dynamic update actions. There were no currently active workflow rules at the time of the read-only check. The candidate RPC now takes a table `SHARE` lock and refuses any active candidate rules, serializing against concurrent rule activation. This is deliberately fail-closed until the workflow allowlist/business approval is independently completed.
- These two safeguards add a function and a trigger to the proposed release scope; 48-object baseline preflight and full rollout review must be updated accordingly. No hosted changes.
