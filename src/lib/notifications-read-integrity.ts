/**
 * Build135: strict owner and type verification for the bounded notification
 * feed. Only client-side data consistency; server-side RLS is authoritative.
 */
export interface OwnedNotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}
export function verifyOwnedNotificationRows(
  rows: readonly OwnedNotificationItem[] | null | undefined,
  userId: string,
): OwnedNotificationItem[] {
  if (typeof userId !== "string" || !userId.trim() || !Array.isArray(rows))
    throw new Error("Notification source is not verified");
  for (const row of rows) {
    if (!row || typeof row !== "object" ||
        typeof row.id !== "string" || !row.id.trim() ||
        row.user_id !== userId ||
        typeof row.title !== "string" ||
        (row.message !== null && typeof row.message !== "string") ||
        (row.type !== null && typeof row.type !== "string") ||
        typeof row.is_read !== "boolean" ||
        typeof row.created_at !== "string" || !row.created_at.trim())
      throw new Error("Notification source has invalid or foreign owner metadata");
  }
  return [...rows];
}
