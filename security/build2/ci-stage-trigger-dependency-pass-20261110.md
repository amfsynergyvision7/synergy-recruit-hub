# Stage-trigger dependency batch — verified 2026-11-10

GitHub Actions run #132: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42686555682

Tested commit `f4d9918fe896b913da8e946883d4e64669b840fd`. Both CI jobs succeeded; **14 PostgreSQL PASS groups**, including:

`PASS: privileged stage-history trigger writes while authenticated direct INSERT remains denied`

The new disposable fixture creates a SECURITY DEFINER trigger with fixed search_path and fully qualified history table; an authenticated recruiter inserts a permitted synthetic event, trigger writes history and attributes actor, while browser role still has no direct history INSERT privilege.

This does **not** execute the actual `track_stage_changes()` function or the actual `on_candidate_stage_change()` financial side effects. Verified production catalog dependency and hard-coded fee/tax constants are documented in `live-stage-trigger-financial-side-effects-20261110.md`. The constants are not approved company pricing or tax policy.

No production modifications, business-row reads, merge, deployment or external communications. Nine release gates blocked.
