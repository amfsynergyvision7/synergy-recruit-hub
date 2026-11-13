/** Pure safety checks for candidate imports; no access to CRM data. */
export interface CandidateRef { id: string }
export function uniqueCandidateMatch<T extends CandidateRef>(rows: readonly T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Ambiguous candidate identity; manual review required');
  return rows[0];
}
export function reconcileCandidateMatches<T extends CandidateRef>(
  mobile: T | null | undefined, email: T | null | undefined,
): T | null {
  if (mobile && email && mobile.id !== email.id) {
    throw new Error('Conflicting candidate identities; manual review required');
  }
  return mobile ?? email ?? null;
}
/** Treat imported email as a literal, not an ILIKE wildcard expression. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
export function advanceContiguousCursor(previous: number, completedRow: number): number {
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(completedRow) ||
      previous < 1 || completedRow < 2 || completedRow !== previous + 1) {
    throw new Error('Non-contiguous candidate sync cursor; manual review required');
  }
  return completedRow;
}

/**
 * Safe client-facing and persistent sync diagnostics. Provider/DB exception
 * bodies, past raw error messages, sheet URLs and candidate values must never
 * be sent to the integration UI or stored in new CRM sync logs.
 */
export const SAFE_CANDIDATE_SYNC_ERROR = "Candidate sync failed; see restricted operations review";

function safeSyncCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 0 && value <= 10000000 ? value : 0;
}
function safeSyncRow(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 1 && value <= 10000000 ? value : 0;
}

export function redactSyncErrors(value: unknown): {row:number; message:string}[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Sync-log errors require restricted review');
  // Preserve error counts for the admin UI without returning original text.
  // Refuse truncated lists instead of showing an incorrect success summary.
  if (value.length > 1000) throw new Error("Sync-log error list requires restricted review");
  return value.map((entry: unknown) => {
    const row = entry && typeof entry === "object" && !Array.isArray(entry)
      ? (entry as Record<string,unknown>).row : null;
    return {row:safeSyncRow(row),message:SAFE_CANDIDATE_SYNC_ERROR};
  });
}

export function sanitizeStoredSyncLogs(value: unknown): Record<string,unknown>[] {
  if (!Array.isArray(value)) throw new Error("Sync-log readback unavailable");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Sync-log readback malformed");
    const entry = item as Record<string,unknown>;
    const errors = redactSyncErrors(entry.errors);
    const rows_scanned=safeSyncCount(entry.rows_scanned);
    const rows_created=safeSyncCount(entry.rows_created);
    const rows_updated=safeSyncCount(entry.rows_updated);
    const rows_skipped=safeSyncCount(entry.rows_skipped);
    const status = ["success","partial","error"].includes(String(entry.status))
      ? entry.status : "unknown";
    return {
      id: typeof entry.id === "string" && /^[0-9a-f-]{36}$/i.test(entry.id) ? entry.id : null,
      module: entry.module === "candidates" ? "candidates" : "other",
      triggered_by: ["manual","scheduled","cron"].includes(String(entry.triggered_by))
        ? entry.triggered_by : "other",
      rows_scanned,rows_created,rows_updated,rows_skipped,
      errors,status,
      message: "Sync record available; provider diagnostics redacted",
      created_at: typeof entry.created_at==="string" && /^\d{4}-\d\d-\d\dT/.test(entry.created_at)
        ? entry.created_at : null,
    };
  });
}
