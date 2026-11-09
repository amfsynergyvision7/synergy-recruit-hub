# Live candidate stage-trigger dependency and financial automation review — 2026-11-10

Source: authorized read-only PostgreSQL catalog metadata (`pg_trigger`, `pg_get_triggerdef`, `pg_get_functiondef`). No candidate, invoice, rule or other business rows were read.

## Verified trigger chain

`public.candidates` has these seven non-internal triggers in catalog metadata:
1. `candidates_sync_defaults_trigger` — BEFORE INSERT, `set_candidate_sync_defaults`, invoker.
2. `candidates_updated_at_trigger` — BEFORE UPDATE, `set_updated_at`, invoker.
3. `set_assigned_recruiter_trigger` — BEFORE INSERT, `set_assigned_recruiter`, **SECURITY DEFINER**.
4. `set_candidate_sync_defaults_trigger` — BEFORE INSERT, `set_candidate_sync_defaults`, invoker.
5. `track_stage_changes_trigger` — AFTER UPDATE OF stage, `track_stage_changes`, **SECURITY DEFINER**.
6. `trg_candidate_stage_change` — AFTER UPDATE OF stage WHEN stage actually changes, `on_candidate_stage_change`, **SECURITY DEFINER**.
7. `workflow_rules_trigger` — AFTER INSERT OR UPDATE, `run_workflow_rules`, **SECURITY DEFINER**.

`candidate_stage_history` has no non-internal triggers in the inspected result. `track_stage_changes()` writes a history record with `NEW.id`, old/new stages and `auth.uid()` as `changed_by`. The writer has `SECURITY DEFINER` privileges and no explicit `SET search_path` clause; its INSERT target is **unqualified** `candidate_stage_history`. This requires fixed search_path and fully qualified object review. The function is a necessary dependency of stage-history direct-write restrictions.

`set_assigned_recruiter()` assigns `auth.uid()` when `NEW.assigned_recruiter` is NULL. It is SECURITY DEFINER without fixed search_path; this may make earlier policy assumptions about null assignment incompatible and does not itself prevent a client from supplying a different non-NULL recruiter.

## Automatic stage side effects

`on_candidate_stage_change()` is SECURITY DEFINER with `search_path='public'`. It conditionally writes:
- `submitted_to_client` -> `submissions` plus `candidate_activities`.
- `interview_scheduled` -> `interviews` plus activities.
- `offer_released` -> `offers` (including salary/CTC derived from expected salary) plus activities.
- `joined` -> `billing` and activities; computes `placement_fee = ROUND(salary * 0.0833,2)`, `gst = ROUND(placement_fee * 0.18,2)`, and invoice/outstanding amount as their sum.

**The 0.0833 fee and 0.18 tax rates are observed source-code constants, NOT validated AMF fees, contractual terms or tax advice.** Require independent management, finance and legal/tax review. The function's exception handler attempts an `automation_error` activity and returns `NEW`, so downstream failures may not be surfaced as a failed candidate update. Review auditability and partial outcomes. No live candidate stages were changed.

## Required design before deployment

1. Map exact trigger execution order and recursion; test stage transitions through both stage-change triggers and workflow rules with synthetic data.
2. Validate caller authorization for `candidates.stage` and immutability of `assigned_recruiter` before privileged side effects; never rely on a UI-only role check.
3. Review and fix search_path for definer functions and qualify objects; restrict EXECUTE where compatible with trigger invocation.
4. Keep stage-history browser INSERT/UPDATE/DELETE denied, while preserving privileged writer function's intended INSERT.
5. Ensure billing/offer automation cannot be triggered by unauthorized stage updates; validate all financial rules with approved sources.
6. Require an audited failure/rollback policy, exact synthetic test for duplicate prevention, and explicit production approval.

**Status:** design review only. No production changes, no external communications, no merge/deploy; all nine release gates remain blocked.
