# Workflow-rule UI versus privileged SQL allowlist — compatibility review (2026-11-10)

Source reviewed on unmerged security branch: `src/routes/_app.workflow-rules.tsx`. The admin-only UI defines the following `update_field` choices, using the same field list as workflow conditions:

| Table | UI update fields | Provisional synthetic allowlist | Gap |
|---|---|---|---|
| candidates | stage | stage | aligned |
| submissions | status | status | aligned |
| interviews | status | status | aligned |
| offers | offer_status, joining_status | offer_status | **joining_status missing** |
| billing | payment_status | none | **payment_status intentionally blocked pending finance review** |
| clients | status | none | **status missing** |

**Critical interpretation:** UI controls are not authorization. The live `run_workflow_rules()` function currently builds a dynamic UPDATE from the rule's `update_field_name`; quoting prevents SQL syntax injection but does not restrict which columns are authorized. Existing UI's narrow options cannot defend against direct API writes or previously stored malicious configuration. Conversely, a narrow database allowlist may break legitimate admin-created workflows (especially offers joining status, billing payment status, client status).

The UI also exposes candidate stage transitions to `joined`, which can invoke the live privileged stage-change automation and billing calculation. The hard-coded fee/tax percentages in that function are **not** approved policy; approval and reconciliation requirements remain unresolved.

**Required before activation:** obtain workflow owner approval for each table/field/action and its permitted values; specifically obtain finance approval for billing status updates, joining-status changes and automatic billing side effects. Implement server-side rule configuration validation and an in-function allowlist (not just a UI dropdown). Test role-gated CRUD, inactive/unauthorized rule configurations, trigger recursion and side effects against full disposable schema and application. Preserve a fail-closed behavior for unsupported fields, with visible admin errors and safe remediation for existing rules. Never silently broaden the allowlist to match the UI.

Review-only evidence. No business rows accessed; no production DDL, deployment, merge or external communication. All nine release gates blocked.
