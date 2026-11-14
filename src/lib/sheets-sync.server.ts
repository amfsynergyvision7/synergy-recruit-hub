import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CANDIDATE_FIELDS } from "./candidate-fields";
import { assertApprovedRole } from "./access-gates.server";
import { assertExternalEffectReleased } from "./external-effects-hold.server";
import { uniqueCandidateMatch, reconcileCandidateMatches, escapeIlikeLiteral, advanceContiguousCursor, sanitizeStoredSyncLogs, SAFE_CANDIDATE_SYNC_ERROR, redactHistoricalIntegrationError, extractApprovedSpreadsheetId, buildSafeSheetValuesPath, approvedCandidateMappingTarget, approvedCandidateHeaderAlias, assertUnambiguousCandidateSheetMapping } from "./sync-safety";
import { readResponseTextBounded } from "./safe-remote-download.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export { CANDIDATE_FIELDS };

const LEGACY_FIELD_NAMES: Record<string, string> = {
  position: "position_applied",
  experience: "experience_years",
};

function normalizeFieldName(field: unknown): string | undefined {
  return approvedCandidateMappingTarget(field, LEGACY_FIELD_NAMES, CANDIDATE_FIELDS);
}

const FIELD_ALIASES: Record<string, string> = {
  "full name": "full_name", "name": "full_name", "candidate name": "full_name",
  "mobile": "mobile", "phone": "mobile", "phone number": "mobile", "contact": "mobile",
  "email": "email", "email address": "email", "e-mail": "email",
  "location": "location", "city": "location", "current location": "location",
  "position": "position_applied", "position applied": "position_applied", "role": "position_applied", "applied for": "position_applied",
  "current company": "current_company", "company": "current_company", "employer": "current_company",
  "experience (yrs)": "experience_years", "experience": "experience_years", "experience years": "experience_years", "years of experience": "experience_years", "exp": "experience_years",
  "current salary": "current_salary", "ctc": "current_salary",
  "expected salary": "expected_salary", "expected ctc": "expected_salary",
  "notice period": "notice_period", "notice": "notice_period",
  "resume": "resume_url", "resume url": "resume_url", "resume link": "resume_url", "cv": "resume_url",
  "source": "source",
  "notes": "notes", "note": "notes", "remarks": "notes",
};

export function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    // Pure, executable own-key and allowlist checks for untrusted Sheet labels.
    const f = approvedCandidateHeaderAlias(h, FIELD_ALIASES, CANDIDATE_FIELDS);
    if (f) map[h] = f;
  }
  return map;
}

export function extractSpreadsheetId(url: string): string | null {
  return extractApprovedSpreadsheetId(url);
}

export async function assertAdminUser(userId: string) {
  await assertApprovedRole(userId, ["admin"]);
}

/**
 * No caller-provided request headers or redirect handling. The only supported
 * operation is an exact Sheets values.get path on this fixed gateway host.
 * Never expose raw remote text, URL, error details, or account metadata.
 */
async function gw(path: string) {
  if (!/^\/spreadsheets\/[A-Za-z0-9_-]{10,160}\/values\/[^/?#]+!A1%3AZ100000$/.test(path)) {
    throw new Error("Sheets gateway path is not approved");
  }
  const lk = process.env.LOVABLE_API_KEY;
  const sk = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lk || !sk) throw new Error("Sheets provider credentials are unavailable");
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: "GET",
      redirect: "error", // Never replay either credential to redirected hosts.
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${lk}`,
        "X-Connection-Api-Key": sk,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error("Sheets gateway returned an unsuccessful response");
    }
    // Previously res.text() materialized unlimited provider data and could
    // echo private candidate cells; use the shared streaming 1-MiB ceiling.
    const body = await readResponseTextBounded(res, 1024 * 1024);
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Sheets gateway returned an invalid payload");
    }
    return data as {values?:unknown};
  } catch {
    // Suppress provider exceptions: some include access keys or sheet data.
    throw new Error("Sheets gateway request unavailable; check restricted diagnostics");
  }
}

export interface GoogleIntegrationSettings {
  id: string;
  user_id: string;
  sheet_url: string | null;
  spreadsheet_id: string | null;
  sheet_name: string | null;
  header_row: number;
  auto_sync_enabled: boolean;
  sync_frequency_minutes: number;
  last_sync: string | null;
  last_synced_row: number;
  google_account_email: string | null;
  connection_status: string | null;
  column_mapping: Record<string, string> | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function formatSupabaseError(action: string, _error: unknown) {
  // Callers include this message in UI errors. Never interpolate provider
  // response bodies, hints, SQL details, private URLs or identifiers.
  return `${action}; inspect restricted server diagnostics`;
}

export interface SyncDiagnostics {
  settingsLoaded: boolean;
  settingsRowFound?: boolean;
  loggedUserId?: string | null;
  settingsRowId?: string | null;
  fetchedSheetUrl?: string | null;
  saveSuccess?: boolean;
  saveError?: string | null;
  spreadsheetFound: boolean;
  tabFound: boolean;
  headersFound: boolean;
  rowsFetched: number;
}

export function diagnosticsForIntegration(integ?: GoogleIntegrationSettings | null, values?: unknown[][] | null, extra: Partial<SyncDiagnostics> = {}): SyncDiagnostics {
  const headerRow = integ?.header_row || 1;
  const headers = Array.isArray(values) ? values[headerRow - 1] : null;
  return {
    settingsLoaded: !!integ,
    settingsRowFound: !!integ,
    settingsRowId: integ?.id ?? null,
    fetchedSheetUrl: integ?.sheet_url ?? null,
    spreadsheetFound: !!integ?.spreadsheet_id,
    tabFound: Array.isArray(values),
    headersFound: Array.isArray(headers) && headers.length > 0,
    rowsFetched: Array.isArray(values) ? Math.max(0, values.length - headerRow) : 0,
    ...extra,
  };
}

export async function getSavedGoogleIntegration(opts: { backfillLegacy?: boolean; userId?: string } = {}): Promise<GoogleIntegrationSettings | null> {
  if (!opts.userId) throw new Error("Explicit integration owner required");
  let query = (supabaseAdmin as any)
    .from("google_integrations")
    // Never fetch legacy last_error, which could contain raw sheet rows or
    // bearer-like provider details from deployments before Build97.
    .select("id,user_id,sheet_url,spreadsheet_id,sheet_name,header_row,auto_sync_enabled,sync_frequency_minutes,last_sync,last_synced_row,google_account_email,connection_status,column_mapping,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(formatSupabaseError("Load Google integration settings failed", error));
  if (data) return redactHistoricalIntegrationError({...(data as GoogleIntegrationSettings),last_error:null});
  // Legacy `public.integrations` is an OWNERLESS table (no user_id).
  // Reassigning its historical sheet URL, credentials or mappings to any
  // currently signed-in admin would transfer another user's configuration.
  // No automatic backfill is safe without a separate reviewed owner mapping.
  if (opts.backfillLegacy === true) {
    throw new Error("Legacy Sheets integration requires independently reviewed owner mapping");
  }
  return null;
}

export async function saveGoogleIntegrationSettings(input: {
  user_id: string;
  sheet_url: string;
  sheet_name: string;
  header_row: number;
  auto_sync_enabled: boolean;
  sync_frequency_minutes?: number;
  column_mapping?: Record<string, string>;
  google_account_email?: string | null;
}) {
  assertExternalEffectReleased("integration_configuration");
  if (!input.user_id) throw new Error("Missing user_id for Google integration settings");
  const current = await getSavedGoogleIntegration({ backfillLegacy: false, userId: input.user_id });
  const spreadsheetId = input.sheet_url ? extractSpreadsheetId(input.sheet_url) : null;
  if (input.sheet_url && !spreadsheetId) {
    throw new Error("Invalid Google Sheet URL — must look like https://docs.google.com/spreadsheets/d/<ID>/edit");
  }

  const payload = {
    user_id: input.user_id,
    sheet_url: input.sheet_url || null,
    spreadsheet_id: spreadsheetId,
    sheet_name: input.sheet_name || "Form Responses 1",
    header_row: input.header_row || 1,
    auto_sync_enabled: !!input.auto_sync_enabled,
    sync_frequency_minutes: input.sync_frequency_minutes || current?.sync_frequency_minutes || 2,
    connection_status: spreadsheetId ? "configured" : "not_configured",
    column_mapping: input.column_mapping ?? current?.column_mapping ?? {},
    mapping: input.column_mapping ?? current?.column_mapping ?? {},
    google_account_email: input.google_account_email ?? current?.google_account_email ?? null,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  const write = current?.id
    ? (supabaseAdmin as any).from("google_integrations").update(payload).eq("id", current.id).eq("user_id", input.user_id).select("id,user_id,sheet_url,spreadsheet_id,sheet_name,header_row,auto_sync_enabled,sync_frequency_minutes,last_sync,last_synced_row,google_account_email,connection_status,column_mapping,created_at,updated_at").single()
    : (supabaseAdmin as any).from("google_integrations").insert(payload).select("id,user_id,sheet_url,spreadsheet_id,sheet_name,header_row,auto_sync_enabled,sync_frequency_minutes,last_sync,last_synced_row,google_account_email,connection_status,column_mapping,created_at,updated_at").single();
  const { data, error } = await write;
  if (error) throw new Error(formatSupabaseError(current?.id ? "Update Google integration settings failed" : "Insert Google integration settings failed", error));
  if (!data) throw new Error("Save returned no integration settings");
  return redactHistoricalIntegrationError(data as GoogleIntegrationSettings);
}

export async function saveDetectedHeaders(integration: GoogleIntegrationSettings, suggested: Record<string, string>) {
  assertExternalEffectReleased("integration_configuration");
  // A service-role UPDATE must retain the authenticated owner's binding,
  // not rely on a caller-supplied integration ID alone.
  if (!integration?.user_id || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(integration.user_id) ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(integration.id)) {
    throw new Error("Integration owner binding is unavailable");
  }
  const { error } = await (supabaseAdmin as any).from("google_integrations").update({
    column_mapping: { ...suggested, ...(integration.column_mapping ?? {}) },
    connection_status: "headers_detected",
    last_error: null,
  }).eq("id", integration.id).eq("user_id", integration.user_id);
  if (error) throw new Error('Integration header mapping unavailable');
}

export async function resetGoogleIntegrationSyncCursor(_integrationId: string) {
  // A cursor reset without the corresponding idempotency ledger would
  // permit ambiguous reimports; require a separate reviewed reconciliation.
  throw new Error("Sync cursor reset is disabled pending safe ledger reconciliation");
}

export async function getCandidateSyncLogs() {
  // Historical sync_logs may contain unredacted upstream exceptions from
  // older code. Preserve harmless counters/status; redact on the server
  // before an approved administrator receives ANY log response.
  const { data, error } = await supabaseAdmin
    .from("sync_logs")
    // Least-data query: never retrieve historical raw provider message,
    // sheet URLs, owner addresses or other future log columns.
    .select("id, module, triggered_by, rows_scanned, rows_created, rows_updated, rows_skipped, errors, status, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(50);
  if (error) throw new Error("Sync log retrieval unavailable");
  return sanitizeStoredSyncLogs(data ?? []);
}

export async function fetchSheetValues(spreadsheetId: string, sheetName: string) {
  // External connector reads also require an independent privacy release.
  assertExternalEffectReleased("integration_configuration");
  const path = buildSafeSheetValuesPath(spreadsheetId, sheetName);
  const data = await gw(path);
  if (data.values == null) return [];
  if (!Array.isArray(data.values) ||
      data.values.some((row: unknown) => !Array.isArray(row) || row.length > 26 ||
        row.some((cell: unknown) => typeof cell !== "string"))) {
    throw new Error("Sheets gateway row payload is invalid");
  }
  return data.values as string[][];
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
}

function rowToCandidate(headers: string[], row: string[], mapping: Record<string, string>) {
  const obj: Record<string, any> = {};
  headers.forEach((h, i) => {
    const field = normalizeFieldName(mapping[h]);
    // Defense in depth: neither mapped headers nor saved integration settings
    // can instruct a service-role import to set ids, roles, stages or owners.
    if (!field || !CANDIDATE_FIELDS.includes(field as typeof CANDIDATE_FIELDS[number])) return;
    const val = row[i];
    if (val === undefined || val === "") return;
    if (field === "experience_years" || field === "current_salary" || field === "expected_salary") {
      const n = num(val); if (n !== null) obj[field] = n;
    } else {
      obj[field] = String(val).trim();
    }
  });
  if (obj.email) obj.email = String(obj.email).trim().toLowerCase();
  if (obj.mobile) obj.mobile = String(obj.mobile).replace(/[\s()-]/g, "").trim();
  return obj;
}

export interface SyncResult {
  created: number; updated: number; skipped: number; errors: number;
  rows_scanned: number; rows_created: number; rows_updated: number;
  rows_skipped: number; error_details: { row: number; message: string }[];
  diagnostics?: SyncDiagnostics;
}

function emptyResult(): SyncResult {
  return { created: 0, updated: 0, skipped: 0, errors: 0, rows_scanned: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, error_details: [] };
}

async function runCandidateSyncUnsafe(opts: { fullHistory?: boolean; triggeredBy: string; userId?: string; leaseHeartbeat?: () => Promise<void>; leaseToken?: string; atomicRowWrites?: boolean }): Promise<SyncResult> {
  if (opts.atomicRowWrites && (!opts.leaseToken || !opts.leaseHeartbeat || !opts.userId)) {
    throw new Error("Atomic sync requires owner, lease token and heartbeat");
  }
  // Assignment is an explicit release configuration, never inferred from
  // the service-role session or selected randomly from existing recruiters.
  const assignedRecruiterId = process.env.CANDIDATE_SYNC_ASSIGNED_RECRUITER_ID;
  if (!assignedRecruiterId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(assignedRecruiterId)) {
    throw new Error("Candidate sync requires an approved recruiter assignment configuration");
  }
  const integ = await getSavedGoogleIntegration({ userId: opts.userId });
  if (!integ || !integ.spreadsheet_id) throw new Error("Google Sheet not configured");
  if (!opts.userId || integ.user_id !== opts.userId) {
    throw new Error("Candidate sync integration owner mismatch");
  }

  const sheetName = integ.sheet_name || "Form Responses 1";
  const headerRow = integ.header_row || 1;
  const values = await fetchSheetValues(integ.spreadsheet_id, sheetName);
  await opts.leaseHeartbeat?.(); // Abort if a lease expired while fetching the sheet.

  const result = emptyResult();
  result.diagnostics = diagnosticsForIntegration(integ, values);
  if (values.length < headerRow) {
    await opts.leaseHeartbeat?.();
    await (supabaseAdmin as any).from("google_integrations").update({
      last_sync: new Date().toISOString(), connection_status: "success", last_error: null,
    }).eq("id", integ.id).eq("user_id", opts.userId);
    return result;
  }

  const headers = values[headerRow - 1];
  const allowedFields = new Set<string>(CANDIDATE_FIELDS);
  const savedMapping: Record<string, string> = (integ.column_mapping ?? {}) as any;
  const normalizedSaved = Object.fromEntries(Object.entries(savedMapping).flatMap(([header, field]) => {
    const normalized = normalizeFieldName(field);
    if (!normalized || !allowedFields.has(normalized) || header.toLowerCase().trim() === "timestamp") return [];
    return [[header, normalized]];
  }));
  const mapping: Record<string, string> = { ...autoMap(headers), ...normalizedSaved };
  // Never consume the atomic row ledger if identity columns are missing
  // or multiple Sheet labels map to the same candidate database field.
  // This preflight intentionally precedes all row/RPC writes and cursor moves.
  assertUnambiguousCandidateSheetMapping(headers, mapping, CANDIDATE_FIELDS);
  if (JSON.stringify(mapping) !== JSON.stringify(savedMapping)) {
    await opts.leaseHeartbeat?.();
    await (supabaseAdmin as any).from("google_integrations").update({ column_mapping: mapping }).eq("id", integ.id).eq("user_id", opts.userId);
  }

  const startIdx = opts.fullHistory ? headerRow : Math.max(headerRow, integ.last_synced_row || headerRow);
  let lastSynced = opts.fullHistory ? headerRow : Math.max(headerRow, integ.last_synced_row || headerRow);
  if (!opts.fullHistory && lastSynced > values.length) {
    throw new Error("Source sheet row count shrank; manual resync review required");
  }

  for (let i = startIdx; i < values.length; i++) {
    await opts.leaseHeartbeat?.();
    const sheetRowNumber = i + 1;
    result.rows_scanned++;
    try {
      const cand = rowToCandidate(headers, values[i], mapping);
      if (opts.atomicRowWrites) {
        // One PostgreSQL RPC atomically fences the lease, resolves a candidate,
        // stores the idempotency ledger, creates the notification and advances
        // the cursor. A missing RPC fails closed: never fall back to separate writes.
        await opts.leaseHeartbeat?.();
        const { data: committed, error: commitError } = await (supabaseAdmin as any).rpc(
          "crm_commit_candidate_sync_row", {
            p_owner: opts.userId,
            p_token: opts.leaseToken,
            p_integration: integ.id,
            p_row_number: sheetRowNumber,
            p_candidate: cand,
            p_assigned_recruiter: assignedRecruiterId,
          },
        );
        if (commitError || !Array.isArray(committed) || committed.length !== 1) {
          throw new Error("Atomic candidate sync commit unavailable");
        }
        const action: unknown = committed[0]?.outcome;
        if (action === "created") result.rows_created++;
        else if (action === "updated") result.rows_updated++;
        else if (action === "skipped" || action === "replayed") result.rows_skipped++;
        else throw new Error("Unexpected atomic candidate sync result");
        lastSynced = advanceContiguousCursor(lastSynced, sheetRowNumber);
        continue;
      }
      if (!cand.full_name && !cand.email && !cand.mobile) {
        result.rows_skipped++; lastSynced = advanceContiguousCursor(lastSynced, sheetRowNumber); continue;
      }
      cand.full_name = cand.full_name || cand.email || cand.mobile;
      cand.source = cand.source || "Google Form";
      cand.stage = "lead_received";
      cand.status = "active";
      cand.created_source = "google_form_sync";

      const candidateSelect = "id, full_name, mobile, email, location, position_applied, current_company, experience_years, current_salary, expected_salary, notice_period, source, resume_url, notes, status, created_source";
      let mobileMatch: { id: string; [key: string]: any } | null = null;
      let emailMatch: { id: string; [key: string]: any } | null = null;
      if (cand.mobile) {
        const { data: matches, error } = await (supabaseAdmin.from("candidates") as any)
          .select(candidateSelect).eq("mobile", cand.mobile).order("created_at", { ascending: false }).limit(2);
        if (error) throw error;
        mobileMatch = uniqueCandidateMatch<{ id: string; [key: string]: any }>(matches);
      }
      if (cand.email) {
        const { data: matches, error } = await (supabaseAdmin.from("candidates") as any)
          .select(candidateSelect).ilike("email", escapeIlikeLiteral(cand.email)).order("created_at", { ascending: false }).limit(2);
        if (error) throw error;
        emailMatch = uniqueCandidateMatch<{ id: string; [key: string]: any }>(matches);
      }
      const existing = reconcileCandidateMatches(mobileMatch, emailMatch);
      const existingId = existing?.id ?? null;

      if (existingId) {
        const upd: Record<string, any> = {};
        Object.entries(cand).forEach(([key, value]) => {
          if (key === "stage" || value === undefined || value === null || value === "") return;
          if (String(existing?.[key] ?? "") !== String(value)) upd[key] = value;
        });
        if (Object.keys(upd).length > 0) {
          await opts.leaseHeartbeat?.();
          const { error } = await (supabaseAdmin.from("candidates") as any).update(upd).eq("id", existingId);
          if (error) throw error;
        }
        result.rows_updated++;
      } else {
        await opts.leaseHeartbeat?.();
        const { data: ins, error } = await (supabaseAdmin.from("candidates") as any).insert(cand).select("id, candidate_code, full_name").single();
        if (error) throw error;
        result.rows_created++;
        await opts.leaseHeartbeat?.();
        await supabaseAdmin.from("notifications").insert({
          title: "New Candidate Added via Google Form",
          message: `${ins.full_name} (${ins.candidate_code}) was synced from Google Sheets.`,
          type: "success",
        });
      }
      lastSynced = advanceContiguousCursor(lastSynced, sheetRowNumber);
    } catch {
      // A DB/provider exception can contain private candidate cells, URLs
      // or access diagnostics. Persist only the generic bounded row marker.
      result.error_details.push({ row: sheetRowNumber, message: SAFE_CANDIDATE_SYNC_ERROR });
      result.rows_skipped++;
      break; // Fail fast: do not checkpoint beyond a failed row.
    }
  }

  result.created = result.rows_created;
  result.updated = result.rows_updated;
  result.skipped = result.rows_skipped;
  result.errors = result.error_details.length;

  const status = result.errors ? (result.created + result.updated > 0 ? "partial" : "error") : "success";
  await opts.leaseHeartbeat?.();
  await (supabaseAdmin as any).from("google_integrations").update({
    last_sync: new Date().toISOString(),
    // Atomic RPC already checkpointed each committed row in the same
    // transaction; never overwrite its cursor with stale browser/server state.
    ...(!opts.atomicRowWrites ? { last_synced_row: lastSynced } : {}),
    connection_status: status,
    last_error: result.error_details.length ? result.error_details[0].message : null,
  }).eq("id", integ.id).eq("user_id", opts.userId);

  await supabaseAdmin.from("sync_logs").insert({
    module: "candidates",
    triggered_by: opts.triggeredBy,
    rows_scanned: result.rows_scanned,
    rows_created: result.rows_created,
    rows_updated: result.rows_updated,
    rows_skipped: result.rows_skipped,
    errors: result.error_details,
    status,
    message: `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors}`,
  });

  return result;
}

export async function runCandidateSync(opts: { fullHistory?: boolean; triggeredBy: string; userId?: string; leaseHeartbeat?: () => Promise<void>; leaseToken?: string; atomicRowWrites?: boolean }): Promise<SyncResult> {
  assertExternalEffectReleased("candidate_sync");
  if (!opts.userId) throw new Error("Explicit sync owner required");
  if (opts.fullHistory) throw new Error("Full-history sync disabled until ledger reconciliation");
  // Public sync entry points may not bypass the database-backed owner lease.
  if (!opts.atomicRowWrites || !opts.leaseToken || !opts.leaseHeartbeat) {
    throw new Error("Non-atomic candidate sync disabled until transactional release");
  }
  try {
    return await runCandidateSyncUnsafe(opts);
  } catch (e: any) {
    // Provider errors can contain sensitive candidate/sheet information.
    // Never persist or return a raw provider exception in sync diagnostics.
    const message = SAFE_CANDIDATE_SYNC_ERROR;
    const result = emptyResult();
    result.errors = 1;
    result.error_details = [{ row: 0, message }];

    try {
      const integ = await getSavedGoogleIntegration({ backfillLegacy: false, userId: opts.userId });
      if (integ?.id) await (supabaseAdmin as any).from("google_integrations").update({
        last_sync: new Date().toISOString(),
        connection_status: "error",
        last_error: message,
      }).eq("id", integ.id).eq("user_id", opts.userId);

      await supabaseAdmin.from("sync_logs").insert({
        module: "candidates",
        triggered_by: opts.triggeredBy,
        rows_scanned: 0,
        rows_created: 0,
        rows_updated: 0,
        rows_skipped: 0,
        errors: result.error_details,
        status: "error",
        message,
      });
    } catch (logError) {
      console.error("Failed to write sync failure log");
    }

    return result;
  }
}

export async function fetchHeaders(spreadsheetId: string, sheetName: string, headerRow: number): Promise<string[]> {
  const values = await fetchSheetValues(spreadsheetId, sheetName);
  return values[headerRow - 1] ?? [];
}
