/**
 * Build 117: defense-in-depth against accidentally unscoped notification
 * responses. RLS and explicit query filters remain authoritative.
 */
export function filterOwnedNotificationRows<T extends { user_id?: unknown }>(
  rows: readonly T[] | null | undefined, userId: string | null | undefined,
): T[] {
  if (!Array.isArray(rows) || typeof userId !== "string" || !userId) return [];
  return rows.filter((row) => row != null && row.user_id === userId);
}
