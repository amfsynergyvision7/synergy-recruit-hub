# Workflow SECURITY DEFINER dynamic UPDATE triage — 2026-11-10

Authorized metadata-only `pg_get_functiondef` review confirms `public.run_workflow_rules()` is a `SECURITY DEFINER` trigger function. Its dynamic SQL is structurally:

```sql
EXECUTE format(
 'UPDATE public.%I SET %I = %L WHERE id = %L AND %I IS DISTINCT FROM %L',
 TG_TABLE_NAME, rule.update_field_name, rule.update_field_value, NEW.id,
 rule.update_field_name, rule.update_field_value
);
```

`%I` and `%L` provide safe identifier/literal quoting but **do not enforce an allowed table/column list**. `workflow_rules.update_field_name` is text. The function includes a recursion-depth guard; this is not a substitute for update authorization. Because the function runs with owner privileges, a rule that targets sensitive columns can bypass caller-level controls unless an independent, trusted validation gate rejects it. This is a design risk, not a demonstrated exploit; no live workflow rules or business rows were read.

The disposable CI fixture `synthetic-workflow-field-allowlist.integration.sql` proposes a strict table+column allowlist for a handful of status fields and rejects owner, role, approval, identity, payment and unknown fields. **These allowed fields are provisional**, not a statement of approved company policy. No production function was altered. Before deploying any fix, review all legitimate workflow transitions, trigger tables, data types and downstream side effects; implement a validated allowlist inside the trusted function or a protected rule-management path; test unauthorized rule creation and modification, role escalation, and existing legitimate workflows.

Also observed in read-only metadata: `resolve_candidate_uuid`, `resolve_client_uuid`, `resolve_job_uuid` are `SECURITY DEFINER` lookups accepting arbitrary text, including names/emails and IDs, and can return UUIDs. Review EXECUTE revocation and caller compatibility; they are potential record-enumeration surfaces. `generate_reminders()` is a privileged writer to notifications and uses Asia/Kolkata dates; verify its real scheduler principal before changing grants.

Production unchanged. All nine release gates blocked.
