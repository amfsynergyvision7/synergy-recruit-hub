import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CANDIDATE_FIELDS } from "./candidate-fields";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export { CANDIDATE_FIELDS };


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

export async function fetchSheetValues(spreadsheetId: string, sheetName: string) {
  const range = `${sheetName}!A1:Z100000`;
  const data = await gw(`/spreadsheets/${spreadsheetId}/values/${range}`);
  return (data.values ?? []) as string[][];
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
}

function rowToCandidate(headers: string[], row: string[], mapping: Record<string, string>) {
  const obj: Record<string, any> = {};
  headers.forEach((h, i) => {
    const field = mapping[h];
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
}

function emptyResult(): SyncResult {
  return { created: 0, updated: 0, skipped: 0, errors: 0, rows_scanned: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, error_details: [] };
}

export async function runCandidateSync(opts: { fullHistory?: boolean; triggeredBy: string }): Promise<SyncResult> {
  const { data: integ, error: ierr } = await supabaseAdmin
    .from("integrations").select("*").eq("module", "candidates").maybeSingle();
  if (ierr) throw ierr;
  if (!integ || !integ.spreadsheet_id) throw new Error("Google Sheet not configured");

  const sheetName = integ.sheet_name || "Form Responses 1";
  const headerRow = integ.header_row || 1;
  const values = await fetchSheetValues(integ.spreadsheet_id, sheetName);

  const result = emptyResult();
  if (values.length < headerRow) {
    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(), last_status: "success", last_error: null,
    }).eq("id", integ.id);
    return result;
  }

  const headers = values[headerRow - 1];
  let mapping: Record<string, string> = (integ.column_mapping ?? {}) as any;
  if (!mapping || Object.keys(mapping).length === 0) {
    mapping = autoMap(headers);
    await supabaseAdmin.from("integrations").update({ column_mapping: mapping }).eq("id", integ.id);
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
  await supabaseAdmin.from("integrations").update({
    last_sync_at: new Date().toISOString(),
    last_synced_row: lastSynced,
    last_status: status,
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

export async function fetchHeaders(spreadsheetId: string, sheetName: string, headerRow: number): Promise<string[]> {
  const values = await fetchSheetValues(spreadsheetId, sheetName);
  return values[headerRow - 1] ?? [];
}
