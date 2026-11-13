/**
 * Admin-only duplicate review. PostgREST row caps can silently truncate a
 * .limit(5000) request. Verify every page, total, and ordered row identity.
 * Two passes catch count-preserving row shifts during ordinary concurrent
 * candidate changes; this is NOT a transaction-level database snapshot.
 */
export const DUPLICATE_SCAN_PAGE_SIZE = 500;
export const MAX_COMPLETE_DUPLICATE_SCAN = 5000;
const UNAVAILABLE = "Complete duplicate review unavailable; no partial results returned";

export async function loadCompleteDuplicateReviewRows<T extends { id: string }>(
  client: any,
  columns: string,
): Promise<T[]> {
  const result: T[] = [];
  const ids = new Set<string>();

  // Pass one retrieves the requested candidate fields. Pass two reads IDs
  // only and rejects count-preserving insert/delete shifts that per-page
  // exact counts alone cannot observe. No partial list escapes on failure.
  for (let pass = 0; pass < 2; pass++) {
    let expectedTotal: number | null = null;
    for (let offset = 0; offset === 0 || offset < (expectedTotal ?? 0); offset += DUPLICATE_SCAN_PAGE_SIZE) {
      let response: any;
      try {
        response = await client.from("candidates")
          .select(pass === 0 ? columns : "id", { count: "exact" })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + DUPLICATE_SCAN_PAGE_SIZE - 1);
      } catch {
        // Provider exceptions can contain credentials, URLs, or PII.
        throw new Error(UNAVAILABLE);
      }
      const { data, count, error } = response ?? {};
      if (error || !Number.isSafeInteger(count) || count < 0 ||
          count > MAX_COMPLETE_DUPLICATE_SCAN ||
          (expectedTotal !== null && count !== expectedTotal) ||
          (pass === 1 && count !== result.length) ||
          !Array.isArray(data)) {
        throw new Error(UNAVAILABLE);
      }
      if (expectedTotal === null) expectedTotal = count;
      const expectedLength = Math.min(DUPLICATE_SCAN_PAGE_SIZE, count - offset);
      if (data.length !== expectedLength) throw new Error(UNAVAILABLE);

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as T;
        if (!row || typeof row.id !== "string" || !row.id)
          throw new Error(UNAVAILABLE);
        if (pass === 0) {
          if (ids.has(row.id)) throw new Error(UNAVAILABLE);
          ids.add(row.id);
          result.push(row);
        } else if (result[offset + i]?.id !== row.id) {
          throw new Error(UNAVAILABLE);
        }
      }
      if (count === 0) break;
    }
    if (result.length !== expectedTotal) throw new Error(UNAVAILABLE);
  }
  return result;
}
