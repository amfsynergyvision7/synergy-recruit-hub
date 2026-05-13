import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  runCandidateSync,
  fetchSheetValues,
  autoMap,
  getSavedGoogleIntegration,
  saveGoogleIntegrationSettings,
  diagnosticsForIntegration,
} from "./sheets-sync.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const getIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const integration = await getSavedGoogleIntegration();
    return { integration, diagnostics: diagnosticsForIntegration(integration, null) };
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      sheet_url: z.string().url().or(z.literal("")),
      sheet_name: z.string().min(1).max(120),
      header_row: z.number().int().min(1).max(50),
      auto_sync_enabled: z.boolean(),
      sync_frequency_minutes: z.number().int().min(1).max(60).optional(),
      column_mapping: z.record(z.string(), z.string()).optional(),
    }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const integration = await saveGoogleIntegrationSettings(data);
    return { integration, diagnostics: diagnosticsForIntegration(integration, null) };
  });

export const detectHeaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).optional().parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const integration = await getSavedGoogleIntegration();
    if (!integration?.spreadsheet_id) throw new Error("Google Sheet not configured");
    const sheetName = integration.sheet_name || "Form Responses 1";
    const headerRow = integration.header_row || 1;
    const values = await fetchSheetValues(integration.spreadsheet_id, sheetName);
    const headers = values[headerRow - 1] ?? [];
    const suggested = autoMap(headers);
    if (headers.length) {
      await (supabaseAdmin as any).from("google_integrations").update({
        column_mapping: { ...suggested, ...(integration.column_mapping ?? {}) },
        connection_status: "headers_detected",
        last_error: null,
      }).eq("id", integration.id);
    }
    return { headers, suggested, diagnostics: diagnosticsForIntegration(integration, values) };
  });

export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fullHistory: z.boolean().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.fullHistory) {
      const integration = await getSavedGoogleIntegration();
      if (!integration?.spreadsheet_id) throw new Error("Google Sheet not configured");
      await (supabaseAdmin as any).from("google_integrations").update({ last_synced_row: 1 }).eq("id", integration.id);
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
