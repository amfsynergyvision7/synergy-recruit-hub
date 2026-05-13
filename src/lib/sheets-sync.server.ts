import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const CANDIDATE_FIELDS = [
  "full_name", "mobile", "email", "location", "position_applied",
  "current_company", "experience_years", "current_salary", "expected_salary",
  "notice_period", "resume_url", "source", "notes",
] as const;

const FIELD_ALIASES: Record<string, string> = {
  "name": "full_name", "full name": "full_name", "candidate name": "full_name",
  "phone": "mobile", "phone number": "mobile", "mobile": "mobile", "contact": "mobile",
  "email": "email", "email address": "email", "e-mail": "email",
  "location": "location", "city": "location", "current location": "location",
  "position": "position_applied", "position applied": "position_applied", "role": "position_applied", "applied for": "position_applied",
  "current company": "current_company", "company": "current_company", "employer": "current_company",
  "experience": "experience_years", "experience years": "experience_years", "years of experience": "experience_years", "exp": "experience_years",
  "current salary": "current_salary", "ctc": "current_salary",
  "expected salary": "expected_salary", "expected ctc": "expected_salary",
  "notice period": "notice_period", "notice": "notice_period",
  "resume": "resume_url", "resume url": "resume_url", "resume link": "resume_url", "cv": "resume_url",
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
  return obj;
}

export interface SyncResult {
  rows_scanned: number; rows_created: number; rows_updated: number;
  rows_skipped: number; errors: { row: number; message: string }[];
}

export async function runCandidateSync(opts: { fullHistory?: boolean; triggeredBy: string }): Promise<SyncResult> {
  const { data: integ, error: ierr } = await supabaseAdmin
    .from("integrations").select("*").eq("module", "candidates").maybeSingle();
  if (ierr) throw ierr;
  if (!integ || !integ.spreadsheet_id) throw new Error("Google Sheet not configured");

  const sheetName = integ.sheet_name || "Form Responses 1";
  const headerRow = integ.header_row || 1;
  const values = await fetchSheetValues(integ.spreadsheet_id, sheetName);

  const result: SyncResult = { rows_scanned: 0, rows_created: 0, rows_updated: 0, rows_skipped: 0, errors: [] };
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
      cand.source = cand.source || "Google Form";
      cand.stage = "lead_received";

      // Duplicate detection
      let existingId: string | null = null;
      if (cand.email) {
        const { data: e } = await supabaseAdmin.from("candidates")
          .select("id").ilike("email", cand.email).maybeSingle();
        if (e) existingId = e.id;
      }
      if (!existingId && cand.mobile) {
        const { data: m } = await supabaseAdmin.from("candidates")
          .select("id").eq("mobile", cand.mobile).maybeSingle();
        if (m) existingId = m.id;
      }

      if (existingId) {
        const upd: Record<string, any> = { ...cand }; delete upd.stage;
        const { error } = await (supabaseAdmin.from("candidates") as any).update(upd).eq("id", existingId);
        if (error) throw error;
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
      result.errors.push({ row: sheetRowNumber, message: e?.message || String(e) });
      result.rows_skipped++;
    }
  }

  const status = result.errors.length ? (result.rows_created + result.rows_updated > 0 ? "partial" : "error") : "success";
  await supabaseAdmin.from("integrations").update({
    last_sync_at: new Date().toISOString(),
    last_synced_row: lastSynced,
    last_status: status,
    last_error: result.errors.length ? result.errors[0].message : null,
  }).eq("id", integ.id);

  await supabaseAdmin.from("sync_logs").insert({
    module: "candidates",
    triggered_by: opts.triggeredBy,
    rows_scanned: result.rows_scanned,
    rows_created: result.rows_created,
    rows_updated: result.rows_updated,
    rows_skipped: result.rows_skipped,
    errors: result.errors,
    status,
    message: `Created ${result.rows_created}, updated ${result.rows_updated}, skipped ${result.rows_skipped}`,
  });

  return result;
}

export async function fetchHeaders(spreadsheetId: string, sheetName: string, headerRow: number): Promise<string[]> {
  const values = await fetchSheetValues(spreadsheetId, sheetName);
  return values[headerRow - 1] ?? [];
}
