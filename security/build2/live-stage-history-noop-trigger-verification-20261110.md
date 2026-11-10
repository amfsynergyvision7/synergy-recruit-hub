# Read-only production candidate stage-trigger no-op verification — 2026-11-10

Read-only catalog query inspected `pg_get_triggerdef` and `pg_get_functiondef` for `public.candidates` triggers `track_stage_changes_trigger` and `trg_candidate_stage_change`.

**Verified:** `track_stage_changes_trigger` fires `AFTER UPDATE OF stage` without a trigger-level WHEN clause, but `public.track_stage_changes()` contains `IF OLD.stage IS DISTINCT FROM NEW.stage THEN INSERT INTO candidate_stage_history ... END IF`. Thus a no-op stage UPDATE invokes the function but does **not** insert history from this function. The second trigger `trg_candidate_stage_change` has an explicit `WHEN (old.stage IS DISTINCT FROM new.stage)` and its function also guards no-change stages.

**Conclusion:** prior suspicion of duplicate history entries solely due to no-op stage UPDATE is not supported by the actual function body. A trigger-level WHEN on `track_stage_changes_trigger` may reduce unnecessary calls, but is optional performance hardening, not an urgent data-integrity fix. Do not remove either trigger without staging regression.

**Still verified:** `track_stage_changes()` is SECURITY DEFINER without a fixed function search_path and writes to unqualified `candidate_stage_history`. Its schema-resolution hardening remains justified. `on_candidate_stage_change()` uses hard-coded placement-fee and GST calculations for joined candidates and catches errors while returning NEW. Business fee/tax authorization and explicit failure handling remain mandatory before production changes.

No business records accessed; no DDL, production writes, merge, deployment, or external communication. All release gates remain blocked.
