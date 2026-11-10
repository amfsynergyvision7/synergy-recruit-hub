# Workflow field-allowlist batch — verified 2026-11-10

GitHub Actions run #106: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42684794707

Tested commit `10c4b9147d6439fc26afdb4eb138ac583aea8b35`. Both jobs succeeded, and PostgreSQL logs show **12 PASS groups**, including:

`PASS: proposed workflow field allowlist rejects authorization, ownership, unknown and malformed targets`

The new disposable test denies proposed updates to `assigned_recruiter`, `created_by`, profile approval/activation, role, payment status, IDs, email, unknown tables and malformed column names. It allows four provisional workflow status pairs for test purposes. The production function **does not currently call this allowlist**; the test is a candidate control, not a deployed mitigation.

Read-only production metadata confirms `run_workflow_rules()` uses a `SECURITY DEFINER` dynamic `UPDATE` whose target column comes from `workflow_rules.update_field_name`. `format('%I',...)` prevents identifier injection but not unauthorized column selection. See `live-workflow-definer-dynamic-update-triage-20261110.md`.

No production DDL/DML, no business rows, no merge/deploy. Nine release gates blocked.
