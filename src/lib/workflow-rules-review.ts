/**
 * Build133: read-only workflow rule review projection.
 *
 * Configurable rules can cause cross-record changes, notifications, and
 * financial status transitions. Until independent hosted RLS, trigger and
 * finance acceptance, no browser workflow-rule writes may occur.
 *
 * This flag is unconditional: it is not a user preference, role, environment
 * variable or a gate that the UI can turn on.
 */
export const WORKFLOW_RULE_MUTATIONS_HELD = true as const;

export interface WorkflowReviewRow {
  id: string;
  name: string;
  table_name: string;
  field_name: string;
  field_value: string;
  action_type: string;
  notify_target: string | null;
  update_field_name: string | null;
  update_field_value: string | null;
  is_active: boolean;
  created_at: string;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Transport correctness only; it cannot grant read permission. RLS must
 * independently authorize every row returned by the server.
 */
export function validateWorkflowReviewRows(rows: unknown): WorkflowReviewRow[] | null {
  if (rows === null) return null;
  if (!Array.isArray(rows) || rows.some(r => {
    if (!r || typeof r !== "object" || Array.isArray(r)) return true;
    const row = r as Record<string, unknown>;
    return !isString(row.id) || !row.id.trim() ||
      !isString(row.name) || !isString(row.table_name) ||
      !isString(row.field_name) || !isString(row.field_value) ||
      !isString(row.action_type) ||
      !["notify","update_field"].includes(row.action_type) ||
      (row.notify_target !== null && !isString(row.notify_target)) ||
      (row.update_field_name !== null && !isString(row.update_field_name)) ||
      (row.update_field_value !== null && !isString(row.update_field_value)) ||
      typeof row.is_active !== "boolean" || !isString(row.created_at);
  })) throw new Error("Workflow source data incomplete or malformed");
  return rows as WorkflowReviewRow[];
}
