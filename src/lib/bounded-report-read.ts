/**
 * Build124: explicit, bounded, count-reconciled recruitment report reads.
 *
 * PostgREST can silently truncate a default SELECT response (often 1,000
 * rows). Never turn truncated data into business KPIs or CSV exports.
 * This layer is transport-only; RLS and reviewed backend authorization
 * must independently restrict which rows/columns can be fetched.
 */
export const REPORT_PAGE_SIZE = 250;
export const REPORT_MAX_ROWS = 2500;

export interface ReportRow { id: string }
export interface ReportPage<T extends ReportRow> {
  data: T[] | null;
  error: unknown;
  count: number | null;
}
export type ReportPageReader<T extends ReportRow> =
  (from: number, to: number, signal: AbortSignal) =>
    PromiseLike<ReportPage<T>> | Promise<ReportPage<T>>;

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("Report request cancelled");
}

/**
 * Require an exact RLS-visible row count on EVERY page, so a reduced server
 * page limit, drifting count, missing result, or page overlap never produces
 * a falsely complete financial/recruitment metric.
 */
export async function readBoundedReportRows<T extends ReportRow>(
  page: ReportPageReader<T>, signal: AbortSignal,
): Promise<T[]> {
  checkAbort(signal);
  const rows: T[] = [];
  const seen = new Set<string>();
  let expectedCount: number | null = null;
  for (let from = 0; from <= REPORT_MAX_ROWS; from += REPORT_PAGE_SIZE) {
    checkAbort(signal);
    const to = Math.min(from + REPORT_PAGE_SIZE - 1, REPORT_MAX_ROWS - 1);
    // Never request a range past the explicit limit. A remaining full page
    // with expectedCount > MAX is already rejected at the first page.
    if (from >= REPORT_MAX_ROWS) break;
    const result = await page(from, to, signal);
    checkAbort(signal);
    if (result.error || !Array.isArray(result.data) ||
        !Number.isSafeInteger(result.count) || result.count! < 0)
      throw new Error("Report data unavailable or count not verified");
    if (result.count! > REPORT_MAX_ROWS)
      throw new Error("Report exceeds verified row limit; narrow the scope");
    if (expectedCount === null) expectedCount = result.count!;
    if (result.count !== expectedCount)
      throw new Error("Report changed while reading; retry for consistent counts");
    const needed = Math.min(REPORT_PAGE_SIZE, Math.max(0, expectedCount - from));
    if (result.data.length !== needed)
      throw new Error("Report page incomplete or server limit lower than expected");
    let preceding: string | null = rows.length ? rows.at(-1)!.id : null;
    for (const row of result.data) {
      if (!row || typeof row.id !== "string" || !row.id ||
          seen.has(row.id) || (preceding !== null && row.id <= preceding))
        throw new Error("Report order/identity is inconsistent between pages");
      seen.add(row.id);
      rows.push(row);
      preceding = row.id;
    }
    if (rows.length === expectedCount) return rows;
  }
  throw new Error("Report completeness could not be verified");
}
