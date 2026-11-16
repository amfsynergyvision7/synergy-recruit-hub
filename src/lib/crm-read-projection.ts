/**
 * Build133: minimize the shared CRM browser record and relation projections.
 *
 * Only request fields actually configured by the seven reviewed CRM modules,
 * plus the small documented set needed by their custom render controls and
 * optimistic-write compare. This layer minimizes data transfer; it does not
 * authorize data or substitute for server-side RLS/field grants.
 */
type ModuleName = "candidates" | "clients" | "jobs" | "submissions" |
  "interviews" | "offers" | "billing";

const TABLES: Readonly<Record<ModuleName, string>> = Object.freeze({
  candidates:"candidates",clients:"clients",jobs:"job_openings",
  submissions:"submissions",interviews:"interviews",offers:"offers",
  billing:"billing",
});

/** Non-schema UI render hooks are intentionally never added to SELECT. */
const UI_ONLY: Readonly<Record<string, readonly string[]>> = Object.freeze({
  candidates:["client_resume"],
  interviews:["scheduling_link"],
  jobs:["careers_link"],
});

/**
 * The only extra database columns used by custom row render functions:
 * candidates: summary and ATS preview; update_at for optimistic write CAS.
 * interviews: scheduling button's existing link and proposed time options.
 */
const REQUIRED_EXTRAS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  candidates:["resume_summary","ats_issues","updated_at"],
  interviews:["scheduling_token","proposed_slots"],
});

const COLUMN=/^[a-z][a-z0-9_]*$/;

function assertColumn(column: string): string {
  if (typeof column !== "string" || !COLUMN.test(column))
    throw new Error("Unsupported CRM projection column");
  return column;
}

export interface CrmProjectionOptions {
  module: string;
  table: string;
  fieldNames: readonly string[];
  searchFields?: readonly string[];
  emailField?: string;
  orderBy?: string;
}

/**
 * Refuse undeclared module/table combinations and any expression/alias.
 * No public-facing form value, user query or search string reaches SELECT.
 * Use a sorted canonical projection for stable query behavior and audits.
 */
export function crmRowProjection(input: CrmProjectionOptions): string {
  const table=TABLES[input.module as ModuleName];
  if (!table || table !== input.table)
    throw new Error("CRM module/table pairing is not reviewed");
  const virtual=new Set(UI_ONLY[input.module] ?? []);
  const names=new Set<string>(["id","created_at"]);
  for(const name of [...input.fieldNames,...(input.searchFields??[]),
    ...(input.emailField?[input.emailField]:[]),
    ...(input.orderBy?[input.orderBy]:[]),
    ...(REQUIRED_EXTRAS[input.module]??[])]) {
    const safe=assertColumn(name);
    if (!virtual.has(safe)) names.add(safe);
  }
  return Array.from(names).sort().join(", ");
}

/**
 * Relations are label-bearing references: all seven reviewed modules define
 * explicit safe columns. Never fall back to SELECT * or arbitrary expressions.
 */
export function crmRelationProjection(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("CRM relation projection must be explicitly defined");
  const parts=value.split(",").map(c=>c.trim());
  if (!parts.length || parts.some(c=>!COLUMN.test(c)) ||
      !parts.includes("id") || new Set(parts).size !== parts.length)
    throw new Error("CRM relation projection is malformed or missing ID");
  return parts.join(", ");
}
