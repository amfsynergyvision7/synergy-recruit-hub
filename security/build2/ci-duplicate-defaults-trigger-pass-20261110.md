# Duplicate candidate defaults trigger — verified catalog and CI, 2026-11-10

Read-only live catalog confirms two enabled BEFORE INSERT row triggers on `public.candidates` invoke the **same** `public.set_candidate_sync_defaults()`: `candidates_sync_defaults_trigger` and `set_candidate_sync_defaults_trigger`. Function body fills `candidate_code` with `CAND-` plus `nextval('public.candidate_code_seq')` only when blank, sets stage to `lead_received` only when null and status to `active` when empty/null. It is invoker-security, not SECURITY DEFINER, with `search_path=public`.

Verified isolated PostgreSQL test: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42687720405 — both jobs successful; **17 PASS groups**. Synthetic fixture `synthetic-duplicate-defaults-trigger.integration.sql` reproduces two calls and one sequence increment, then drops one **synthetic** trigger and validates preservation of explicit/default fields.

**Release recommendation (review only):** inspect complete insert pipeline and migrations for intended dual registration; if confirmed redundant, prepare separately approved removal of exactly one duplicate trigger with reversible DDL and pre/post synthetic and staging insert tests. Do not drop either trigger now. This is unnecessary repeated execution, not proof of double-generated codes or actual data corruption.

Separate definer-function hardening: `track_stage_changes()` and `set_assigned_recruiter()` have `proconfig=NULL` (no function-level fixed search_path). `on_candidate_stage_change()` and `run_workflow_rules()` have `search_path=public`; review all privileged object qualification and safe search_path. Catalog checks only; no production DDL or business row access.

No deployment/merge. All nine release gates blocked.
