/**
 * Common completeness invariant for browser CRM lists and relation pickers.
 * A database response is not an accepted role authorization. All requests
 * still require RLS; this check refuses silent page truncation and duplicate
 * keys before rows are displayed, edited or exported.
 */
export function hasCompleteIdList(
  rows: unknown, count: unknown, limit: number,
): rows is Array<{ id: string; [key: string]: unknown }> {
  if (!Number.isSafeInteger(limit) || limit < 1 ||
      !Number.isSafeInteger(count) || (count as number) < 0 ||
      (count as number) > limit || !Array.isArray(rows) ||
      rows.length !== count) return false;
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const id = (row as Record<string, unknown>).id;
    if (typeof id !== "string" || !id.trim() || ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}
