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

export interface SanitizedCandidateSyncLog {
  id: string | null;
  module: "candidates" | "other";
  triggered_by: "manual" | "scheduled" | "cron" | "other";
  rows_scanned: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  errors: {row:number; message:string}[];
  status: "success" | "partial" | "error" | "unknown";
  message: string;
  created_at: string | null;
}

export function sanitizeStoredSyncLogs(value: unknown): SanitizedCandidateSyncLog[] {
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
    const status: SanitizedCandidateSyncLog["status"] =
      entry.status === "success" || entry.status === "partial" || entry.status === "error"
        ? entry.status : "unknown";
    const triggered_by: SanitizedCandidateSyncLog["triggered_by"] =
      entry.triggered_by === "manual" || entry.triggered_by === "scheduled" || entry.triggered_by === "cron"
        ? entry.triggered_by : "other";
    return {
      id: typeof entry.id === "string" && /^[0-9a-f-]{36}$/i.test(entry.id) ? entry.id : null,
      module: entry.module === "candidates" ? "candidates" : "other",
      triggered_by,
      rows_scanned,rows_created,rows_updated,rows_skipped,
      errors,status,
      message: "Sync record available; provider diagnostics redacted",
      created_at: typeof entry.created_at==="string" && /^\d{4}-\d\d-\d\dT/.test(entry.created_at)
        ? entry.created_at : null,
    };
  });
}

// Historical google_integrations.last_error may contain raw upstream provider
// responses from code deployed before the release holds. Never serialize those
// error bodies to the browser, including after a future reviewed save operation.
export function redactHistoricalIntegrationError<T extends {last_error?:string|null}>(record:T):T {
 if(!record||typeof record!=='object'||Array.isArray(record))
   throw new Error("Integration readback malformed");
 return {...record,last_error:
  typeof record.last_error==='string'&&record.last_error.length>0
    ? SAFE_CANDIDATE_SYNC_ERROR : null};
}

/**
 * Sheets connection input is never a generic URL/proxy: it must be an
 * owner-provided docs.google.com spreadsheet link, not an embedded path on
 * another origin. Fragments such as #gid=0 are local navigation only.
 */
export function extractApprovedSpreadsheetId(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" ||
        url.port || url.username || url.password ||
        url.searchParams.has("key") || url.searchParams.has("access_token")) return null;
    const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,160})(?:\/(?:edit|view|copy|preview|htmlview))?\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch { return null; }
}

/**
 * Build an exact Sheets v4 values.get path with a single encoded A1 range.
 * Even a historical database value must not inject query strings, fragments,
 * URL traversal, extra API paths, or unbounded tab names.
 */
export function buildSafeSheetValuesPath(spreadsheetId: string, sheetName: string): string {
  if (typeof spreadsheetId !== "string" ||
      !/^[A-Za-z0-9_-]{10,160}$/.test(spreadsheetId)) {
    throw new Error("Sheet identifier is not approved");
  }
  if (typeof sheetName !== "string" || sheetName.length === 0 ||
      sheetName.length > 120 || /[\u0000-\u001f\u007f]/.test(sheetName)) {
    throw new Error("Sheet tab name is not approved");
  }
  const safeTab = /^[A-Za-z0-9_]+$/.test(sheetName)
    ? sheetName : "'" + sheetName.replace(/'/g, "''") + "'";
  return "/spreadsheets/" + spreadsheetId +
    "/values/" + encodeURIComponent(safeTab + "!A1:Z100000");
}

/**
 * Imported Sheet headers and saved mapping JSON are untrusted. Do not use
 * inherited object keys (constructor, __proto__, toString) as aliases or
 * allow arbitrary database columns in a service-role candidate import.
 */
export function approvedCandidateMappingTarget(
  raw: unknown,
  legacyAliases: Readonly<Record<string,string>>,
  permitted: readonly string[],
): string | undefined {
  if(typeof raw!=="string"||raw.length===0)return undefined;
  const canonical=Object.prototype.hasOwnProperty.call(legacyAliases,raw)
    ? legacyAliases[raw] : raw;
  return typeof canonical==="string"&&permitted.includes(canonical)
    ? canonical : undefined;
}

export function approvedCandidateHeaderAlias(
  raw: unknown,
  aliases: Readonly<Record<string,string>>,
  permitted: readonly string[],
): string | undefined {
  if(typeof raw!=="string"||raw.length>256)return undefined;
  const key=raw.toLowerCase().trim();
  if(!Object.prototype.hasOwnProperty.call(aliases,key))return undefined;
  const field=aliases[key];
  return typeof field==="string"&&permitted.includes(field)?field:undefined;
}

/**
 * Fail closed before any candidate-sync configuration or ledger write.
 * Two visible Sheet columns may not feed the same CRM field: otherwise the
 * final column silently overwrites a prior identity such as email or phone.
 * Nor may a source without any mapped identity column consume the cursor
 * as a series of silently skipped candidate rows.
 */
export function assertUnambiguousCandidateSheetMapping(
  headers: readonly unknown[],
  mapping: Readonly<Record<string,unknown>>,
  permitted: readonly string[],
): void {
  if(!Array.isArray(headers)||headers.length===0||headers.length>26||
     !mapping||typeof mapping!=="object"||Array.isArray(mapping)) {
    throw new Error("Candidate sync column mapping requires manual review");
  }
  const seen=new Set<string>();
  let hasIdentity=false;
  for(const header of headers){
    if(typeof header!=="string"||header.length===0||header.length>256){
      throw new Error("Candidate sync header is not approved");
    }
    if(!Object.prototype.hasOwnProperty.call(mapping,header))continue;
    const field=mapping[header];
    if(typeof field!=="string"||!permitted.includes(field)){
      throw new Error("Candidate sync mapped field is not approved");
    }
    if(seen.has(field)){
      throw new Error("Candidate sync duplicate mapped field requires manual review");
    }
    seen.add(field);
    if(field==="email"||field==="mobile"||field==="full_name")hasIdentity=true;
  }
  if(!hasIdentity){
    throw new Error("Candidate sync requires a mapped identity column");
  }
}
