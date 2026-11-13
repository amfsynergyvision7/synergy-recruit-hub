/**
 * An admin's duplicate review must not silently truncate at PostgREST's
 * effective max-rows setting (often lower than a client .limit(5000)).
 * Fail closed rather than presenting partial duplicate clusters as complete.
 */
export const DUPLICATE_SCAN_PAGE_SIZE = 500;
export const MAX_COMPLETE_DUPLICATE_SCAN = 5000;
const UNAVAILABLE = "Complete duplicate review unavailable; no partial results returned";

export async function loadCompleteDuplicateReviewRows<T extends { id: string }>(
  client: any,
  columns: string,
): Promise<T[]> {
  let expectedTotal: number | null = null;
  const result: T[] = [];
  const ids = new Set<string>();
  for (let offset = 0; offset === 0 || offset < (expectedTotal ?? 0); offset += DUPLICATE_SCAN_PAGE_SIZE) {
    // Exact count is repeated to detect obvious concurrent row-set changes.
    // Tie-break by UUID so equal timestamps have deterministic pagination.
    let query: any;
    try {
      query = await client.from("candidates")
        .select(columns, { count: "exact" })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + DUPLICATE_SCAN_PAGE_SIZE - 1);
    } catch {
      // Network/runtime exceptions can contain internal URLs, provider
      // headers, or candidate identifiers. Never serialize those details.
      throw new Error(UNAVAILABLE);
    }
    const { data, count, error } = query ?? {};
    if (error || !Number.isSafeInteger(count) || count < 0 ||
      count > MAX_COMPLETE_DUPLICATE_SCAN ||
      (expectedTotal !== null && count !== expectedTotal) ||
      !Array.isArray(data)) {
      throw new Error(UNAVAILABLE);
    }
    if (expectedTotal === null) expectedTotal = count;
    const expectedLength = Math.min(DUPLICATE_SCAN_PAGE_SIZE, count - offset);
    if (data.length !== expectedLength) {
      // Detect PostgREST server row-limit truncation instead of silently
      // omitting candidates outside the first 500/1000 records.
      throw new Error(UNAVAILABLE);
    }
    for (const row of data as T[]) {
      if (!row || typeof row.id !== "string" || !row.id ||
          ids.has(row.id)) throw new Error(UNAVAILABLE);
      ids.add(row.id);
      result.push(row);
    }
    if (count === 0) break;
  }
  if (result.length !== expectedTotal) throw new Error(UNAVAILABLE);
  return result;
}
