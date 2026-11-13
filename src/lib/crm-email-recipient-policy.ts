/**
 * Build82: bind a future CRM outbound message to its permitted database
 * recipient. Hard-coded outbound hold stays in force until separate release.
 * This pure helper has no SMTP, database, network, or privileged session use.
 */
export type CrmEmailTable = "candidates" | "clients";
export type CrmEmailRole = "admin" | "recruiter";
export type CrmEmailRecord = {
  email?: string | null;
  assigned_recruiter?: string | null;
} | null;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const cleanEmail = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 254 || /[\r\n\x00-\x1f]/.test(value)) return null;
  const v = value.trim().toLowerCase();
  return v.includes("@") && !v.includes(" ") ? v : null;
};
export function isCrmEmailRecipientBound(args: {
  relatedTable: CrmEmailTable;
  requestedAddress: string;
  record: CrmEmailRecord;
  actingUserId: string;
  approvedRole: CrmEmailRole;
}): boolean {
  const { relatedTable, requestedAddress, record, actingUserId, approvedRole } = args;
  if (!uuid.test(actingUserId) || !record ||
      (approvedRole !== "admin" && approvedRole !== "recruiter")) return false;
  const expected = cleanEmail(record.email);
  const requested = cleanEmail(requestedAddress);
  if (!expected || !requested || expected !== requested) return false;
  if (relatedTable === "clients") return approvedRole === "admin";
  if (relatedTable === "candidates") {
    return approvedRole === "admin" ||
      (approvedRole === "recruiter" && record.assigned_recruiter === actingUserId);
  }
  return false;
}
