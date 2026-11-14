/**
 * Build 131: bounded, exact-count CRM list reader.
 * This is browser-only completeness validation, not authorization: all rows
 * and fields still require approved server-side RLS and field grants.
 *
 * Reuse the independent Build124 count-reconciled, ID-sorted paging adapter:
 * 250 rows/request, up to 2,500 rows total. A changed count, incomplete
 * page, duplicate/out-of-order ID, cancellation, or over-cap table is a HOLD.
 */
import {
  readBoundedReportRows, REPORT_PAGE_SIZE, REPORT_MAX_ROWS,
  type ReportPageReader,
} from "./bounded-report-read.ts";

/**
 * Safely narrow the mixed Supabase dynamic-table response to rows with
 * nonempty string IDs. Some generated tables use numeric keys and
 * parameterized relation projections can infer compiler-only error types.
 * Never assert that their runtime shape is valid without inspecting it.
 */
export function checkedCrmPageIds(rows: unknown): Array<{ id: string }> | null {
  if (rows === null) return null;
  if (!Array.isArray(rows) ||
      rows.some(row => !row || typeof row !== "object" || Array.isArray(row) ||
        typeof row.id !== "string" || !row.id.trim()))
    throw new Error("CRM page has unsupported or malformed record identifiers");
  return rows as Array<{ id: string }>;
}

export const CRM_PAGE_SIZE = REPORT_PAGE_SIZE;
export const CRM_MAX_ROWS = REPORT_MAX_ROWS;

export async function readCompleteCrmRows<T extends { id: string }>(
  readPage: ReportPageReader<T>, signal: AbortSignal,
): Promise<T[]> {
  return readBoundedReportRows(readPage, signal);
}

/**
 * Sort the entire count-confirmed ID snapshot locally, not page-by-page
 * on a mutable nonunique created_at column. Stable ID tie breaker.
 */
export function sortCompleteCrmRows<T extends { id: string }>(
  rows: readonly T[], field: string, ascending = false,
): T[] {
  if (typeof field !== "string" || !/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(field))
    throw new Error("Invalid CRM display sort field");
  const compare = (a: T, b: T): number => {
    const left = (a as Record<string, unknown>)[field];
    const right = (b as Record<string, unknown>)[field];
    if (left == null && right != null) return 1;
    if (right == null && left != null) return -1;
    let order = 0;
    if (typeof left === "number" && typeof right === "number") {
      if (!Number.isFinite(left) || !Number.isFinite(right))
        throw new Error("Invalid CRM numeric sort field");
      order = left < right ? -1 : left > right ? 1 : 0;
    } else if (left != null && right != null) {
      order = String(left) < String(right) ? -1 :
        String(left) > String(right) ? 1 : 0;
    }
    return order === 0
      ? a.id.localeCompare(b.id)
      : ascending ? order : -order;
  };
  return [...rows].sort(compare);
}
