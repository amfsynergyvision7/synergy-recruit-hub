import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCandidateSync, fetchHeaders, autoMap, extractSpreadsheetId } from "./sheets-sync.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const getIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("integrations").select("*").eq("module", "candidates").maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sheet_url: z.string().url().or(z.literal("")),
      sheet_name: z.string().min(1).max(120),
      header_row: z.number().int().min(1).max(50),
      auto_sync: z.boolean(),
      column_mapping: z.record(z.string(), z.string()).optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sid = data.sheet_url ? extractSpreadsheetId(data.sheet_url) : null;
    if (data.sheet_url && !sid) throw new Error("Invalid Google Sheet URL — must look like https://docs.google.com/spreadsheets/d/<ID>/edit");
    const payload: any = {
      module: "candidates",
      sheet_url: data.sheet_url || null,
      spreadsheet_id: sid,
      sheet_name: data.sheet_name,
      header_row: data.header_row,
      auto_sync: data.auto_sync,
    };
    if (data.column_mapping) payload.column_mapping = data.column_mapping;
    const { data: row, error } = await (supabaseAdmin.from("integrations") as any)
      .upsert(payload, { onConflict: "module" })
      .select("*").single();
    if (error) throw new Error(`Save failed: ${error.message}`);
    if (!row) throw new Error("Save returned no row");
    return row;
  });

export const detectHeaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sheet_url: z.string().url(), sheet_name: z.string().min(1), header_row: z.number().int().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sid = extractSpreadsheetId(data.sheet_url);
    if (!sid) throw new Error("Invalid Google Sheet URL");
    const headers = await fetchHeaders(sid, data.sheet_name, data.header_row);
    return { headers, suggested: autoMap(headers) };
  });

export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fullHistory: z.boolean().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.fullHistory) {
      await (supabaseAdmin.from("integrations") as any).update({ last_synced_row: 1 }).eq("module", "candidates");
    }
    const result = await runCandidateSync({ fullHistory: !!data.fullHistory, triggeredBy: data.fullHistory ? "manual_full" : "manual" });
    return result;
  });

export const getSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  });
