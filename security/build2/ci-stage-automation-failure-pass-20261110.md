# Candidate-stage automation failure semantics — verified 2026-11-10

GitHub Actions run #144: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42687356286

Tested commit `676095260e54904c8f59b58438cc9b171e9969db`. Both CI jobs passed; **16 PostgreSQL PASS groups**, including:

`PASS: synthetic swallowed errors leave stage changed; strict errors roll back stage and effects`

The disposable SQL fixture `synthetic-stage-automation-failure.integration.sql` deliberately raises an exception after a downstream write. In an exception-catching trigger, PostgreSQL rolls back the trigger block's downstream write but the caller's stage UPDATE remains committed, with a synthetic audit row. In a strict trigger, the exception propagates and both stage update and side effects roll back. This is expected PostgreSQL transaction behavior.

Read-only live metadata confirms `on_candidate_stage_change()` catches `WHEN OTHERS`, writes `candidate_activities` `automation_error`, then returns `NEW`. Therefore **partial business-process completion is a design risk**. The live handler itself was not executed. Its error-audit INSERT can also fail, which could propagate an exception; do not assert every failure is silently swallowed.

Proposed review-only decision: classify downstream actions by criticality. For billing/offer creation, require explicit management/finance decision on whether failure must abort the stage update or create a durable reconciliation job with visible status and alerts. Test duplicate prevention and idempotency on retries. Never silently treat `joined` as successfully billed based only on stage value. Financial fee/tax constants require independent approval. No changes to production function or records.

All nine release gates remain blocked. No merge/deploy/external communications.
