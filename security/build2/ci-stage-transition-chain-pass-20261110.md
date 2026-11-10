# Synthetic candidate-stage chain — verified 2026-11-10

GitHub Actions run #138: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42686772750

Tested commit `597bac8a14434bea04695849f0776f4c425a6e0a`. Both jobs succeeded; PostgreSQL logs show **15 PASS groups**, including:

`PASS: synthetic candidate stage chain creates single audited effect, blocks cross-owner/inactive and direct writes`

New fixture `synthetic-stage-transition-chain.integration.sql` tests a simplified stage-change event chain with an approved active recruiter, cross-owner and inactive identities, stage-change history and idempotent downstream event creation. It confirms no-op repeated updates do not duplicate history/effects and authenticated browser roles have no direct INSERT to privileged history/effects tables.

**Limitations:** This is a synthetic approximation, not a reproduction of the live `track_stage_changes()`, `on_candidate_stage_change()` or `run_workflow_rules()` definitions. The production chain has additional submissions, interviews, offers, billing, workflow recursion and exception paths; these remain untested end-to-end. The existing fee/tax constants in live function metadata are unapproved and not validated by this fixture. See `live-stage-trigger-financial-side-effects-20261110.md`.

Production unchanged, draft PR unmerged, nine release gates blocked.
