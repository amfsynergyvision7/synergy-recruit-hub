import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CANDIDATE_FIELDS } from "./candidate-fields";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export { CANDIDATE_FIELDS };

const LEGACY_FIELD_NAMES: Record<string, string> = {
  position: "position_applied",
  experience: "experience_years",
};

function normalizeFieldName(field: string | undefined): string | undefined {
  if (!field) return undefined;
  return LEGACY_FIELD_NAMES[field] ?? field;
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
    const key = (h || "").toLowerCase().trim();
    const f = FIELD_ALIASES[key];
    if (f) map[h] = f;
  }
  return map;
}

export function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

export async function assertAdminUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Admin only");
}

async function gw(path: string, init?: RequestInit) {
  const lk = process.env.LOVABLE_API_KEY;
  const sk = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lk) throw new Error("LOVABLE_API_KEY not configured");
  if (!sk) throw new Error("GOOGLE_SHEETS_API_KEY not configured");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lk}`,
      "X-Connection-Api-Key": sk,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
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

function formatSupabaseError(action: string, error: any) {
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  return `${action}: ${parts.join(" | ") || "Unknown database error"}`;
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
  let query = (supabaseAdmin as any)
    .from("google_integrations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(formatSupabaseError("Load Google integration settings failed", error));
  if (data) return data as GoogleIntegrationSettings;
  if (opts.backfillLegacy === false) return null;
  if (!opts.userId) return null;

  const { data: legacy, error: legacyError } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("module", "candidates")
    .maybeSingle();
  if (legacyError) throw legacyError;
  if (!legacy?.sheet_url && !legacy?.spreadsheet_id) return null;

  const spreadsheetId = legacy.spreadsheet_id || (legacy.sheet_url ? extractSpreadsheetId(legacy.sheet_url) : null);
  const payload = {
    user_id: opts.userId,
    sheet_url: legacy.sheet_url,
    spreadsheet_id: spreadsheetId,
    sheet_name: legacy.sheet_name || "Form Responses 1",
    header_row: legacy.header_row || 1,
    auto_sync_enabled: !!legacy.auto_sync,
    sync_frequency_minutes: 2,
    last_sync: legacy.last_sync_at,
    last_synced_row: legacy.last_synced_row || 1,
    connection_status: spreadsheetId ? "configured" : "not_configured",
    column_mapping: legacy.column_mapping ?? {},
    last_error: legacy.last_error ?? null,
  };

  const { data: inserted, error: insertError } = await (supabaseAdmin as any)
    .from("google_integrations")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (insertError) throw new Error(formatSupabaseError("Backfill Google integration settings failed", insertError));
  return inserted as GoogleIntegrationSettings;
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
  if (!input.user_id) throw new Error("Missing user_id for Google integration settings");
  const current = await getSavedGoogleIntegration({ backfillLegacy: true, userId: input.user_id });
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
    ? (supabaseAdmin as any).from("google_integrations").update(payload).eq("id", current.id).eq("user_id", input.user_id).select("*").single()
    : (supabaseAdmin as any).from("google_integrations").insert(payload).select("*").single();
  const { data, error } = await write;
  if (error) throw new Error(formatSupabaseError(current?.id ? "Update Google integration settings failed" : "Insert Google integration settings failed", error));
  if (!data) throw new Error("Save returned no integration settings");
  return data as GoogleIntegrationSettings;
}

export async function saveDetectedHeaders(integration: GoogleIntegrationSettings, suggested: Record<string, string>) {
  const { error } = await (supabaseAdmin as any).from("google_integrations").update({
    column_mapping: { ...suggested, ...(integration.column_mapping ?? {}) },
    connection_status: "headers_detected",
    last_error: null,
  }).eq("id", integration.id);
  if (error) throw error;
}

export async function resetGoogleIntegrationSyncCursor(integrationId: string) {
  const { error } = await (supabaseAdmin as any)
    .from("google_integrations")
    .update({ last_synced_row: 1 })
    .eq("id", integrationId);
  if (error) throw error;
}

export async function getCandidateSyncLogs() {
  const { data, error } = await supabaseAdmin
    .from("sync_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchSheetValues(spreadsheetId: string, sheetName: string) {
  const safeSheetName = /^[A-Za-z0-9_]+$/.test(sheetName) ? sheetName : `'${sheetName.replace(/'/g, "''")}'`;
  const range = `${safeSheetName}!A1:Z100000`;
  const data = await gw(`/spreadsheets/${spreadsheetId}/values/${range}`);
  return Array.isArray(data?.values) ? data.values as string[][] : [];
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
    if (!field) return;
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

async function runCandidateSyncUnsafe(opts: { fullHistory?: boolean; triggeredBy: string; userId?: string }): Promise<SyncResult> {
  const integ = await getSavedGoogleIntegration({ userId: opts.userId });
  if (!integ || !integ.spreadsheet_id) throw new Error("Google Sheet not configured");

  const sheetName = integ.sheet_name || "Form Responses 1";
  const headerRow = integ.header_row || 1;
  const values = await fetchSheetValues(integ.spreadsheet_id, sheetName);

  const result = emptyResult();
  result.diagnostics = diagnosticsForIntegration(integ, values);
  if (values.length < headerRow) {
    await (supabaseAdmin as any).from("google_integrations").update({
      last_sync: new Date().toISOString(), connection_status: "success", last_error: null,
    }).eq("id", integ.id);
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
  if (JSON.stringify(mapping) !== JSON.stringify(savedMapping)) {
    await (supabaseAdmin as any).from("google_integrations").update({ column_mapping: mapping }).eq("id", integ.id);
  }

  const startIdx = opts.fullHistory ? headerRow : Math.max(headerRow, integ.last_synced_row || headerRow);
  let lastSynced = integ.last_synced_row || headerRow;

  for (let i = startIdx; i < values.length; i++) {
    const sheetRowNumber = i + 1;
    result.rows_scanned++;
    try {
      const cand = rowToCandidate(headers, values[i], mapping);
      if (!cand.full_name && !cand.email && !cand.mobile) {
        result.rows_skipped++; lastSynced = sheetRowNumber; continue;
      }
      cand.full_name = cand.full_name || cand.email || cand.mobile;
      cand.source = cand.source || "Google Form";
      cand.stage = "lead_received";
      cand.status = "active";
      cand.created_source = "google_form_sync";

      let existingId: string | null = null;
      let existing: Record<string, any> | null = null;
      const candidateSelect = "id, full_name, mobile, email, location, position_applied, current_company, experience_years, current_salary, expected_salary, notice_period, source, resume_url, notes, status, created_source";
      if (cand.mobile) {
        const { data: m, error } = await (supabaseAdmin.from("candidates") as any)
          .select(candidateSelect).eq("mobile", cand.mobile).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (m) { existingId = m.id; existing = m; }
      }
      if (cand.email) {
        const { data: e, error } = await (supabaseAdmin.from("candidates") as any)
          .select(candidateSelect).ilike("email", cand.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!existingId && e) { existingId = e.id; existing = e; }
      }

      if (existingId) {
        const upd: Record<string, any> = {};
        Object.entries(cand).forEach(([key, value]) => {
          if (key === "stage" || value === undefined || value === null || value === "") return;
          if (String(existing?.[key] ?? "") !== String(value)) upd[key] = value;
        });
        if (Object.keys(upd).length > 0) {
          const { error } = await (supabaseAdmin.from("candidates") as any).update(upd).eq("id", existingId);
          if (error) throw error;
        }
        result.rows_updated++;
      } else {
        const { data: ins, error } = await (supabaseAdmin.from("candidates") as any).insert(cand).select("id, candidate_code, full_name").single();
        if (error) throw error;
        result.rows_created++;
        await supabaseAdmin.from("notifications").insert({
          title: "New Candidate Added via Google Form",
          message: `${ins.full_name} (${ins.candidate_code}) was synced from Google Sheets.`,
          type: "success",
        });
      }
      lastSynced = sheetRowNumber;
    } catch (e: any) {
      result.error_details.push({ row: sheetRowNumber, message: e?.message || String(e) });
      result.rows_skipped++;
    }
  }

  result.created = result.rows_created;
  result.updated = result.rows_updated;
  result.skipped = result.rows_skipped;
  result.errors = result.error_details.length;

  const status = result.errors ? (result.created + result.updated > 0 ? "partial" : "error") : "success";
  await (supabaseAdmin as any).from("google_integrations").update({
    last_sync: new Date().toISOString(),
    last_synced_row: lastSynced,
    connection_status: status,
    last_error: result.error_details.length ? result.error_details[0].message : null,
  }).eq("id", integ.id);

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

export async function runCandidateSync(opts: { fullHistory?: boolean; triggeredBy: string; userId?: string }): Promise<SyncResult> {
  try {
    return await runCandidateSyncUnsafe(opts);
  } catch (e: any) {
    const message = e?.message || String(e) || "Sync failed";
    const result = emptyResult();
    result.errors = 1;
    result.error_details = [{ row: 0, message }];

    try {
      const integ = await getSavedGoogleIntegration({ backfillLegacy: false, userId: opts.userId });
      if (integ?.id) await (supabaseAdmin as any).from("google_integrations").update({
        last_sync: new Date().toISOString(),
        connection_status: "error",
        last_error: message,
      }).eq("id", integ.id);

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
      console.error("Failed to write sync failure log", logError);
    }

    return result;
  }
}

export async function fetchHeaders(spreadsheetId: string, sheetName: string, headerRow: number): Promise<string[]> {
  const values = await fetchSheetValues(spreadsheetId, sheetName);
  return values[headerRow - 1] ?? [];
}
