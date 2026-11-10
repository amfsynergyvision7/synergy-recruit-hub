# Workflow trigger field allowlist integration — verified 2026-11-10

GitHub Actions run #162: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42688326007

Tested commit `4ac68d238373b9f3f89c6d483094e5a8c0e4b80e`. Both CI jobs succeeded; **19 PostgreSQL PASS groups**, including:

`PASS: guarded workflow trigger rejects recruiter reassignment and applies provisional stage update`

The disposable `synthetic-workflow-trigger-guard.integration.sql` fixture places the table/field allowlist check **inside** a SECURITY DEFINER trigger, exercises a forbidden `assigned_recruiter` mutation, verifies rollback, then exercises a provisionally permitted `stage` update. The SQL uses quoted dynamic identifiers/literals and a recursion guard.

This is not the actual production `run_workflow_rules()` definition. Actual workflow_rules configuration rows have not been inspected, so legitimate field pairs and rule-mutation authorization remain unverified. The provisional allowlist is not an approved business requirement. Before production, validate rule administrators, target/column list, recursion, trigger interaction, and intended failure behavior in a fully isolated schema.

Production unchanged, PR unmerged, nine release gates blocked.
