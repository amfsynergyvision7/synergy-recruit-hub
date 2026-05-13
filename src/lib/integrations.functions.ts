import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runCandidateSync,
  fetchSheetValues,
  autoMap,
  assertAdminUser,
  getSavedGoogleIntegration,
  saveGoogleIntegrationSettings,
  saveDetectedHeaders,
  resetGoogleIntegrationSyncCursor,
  getCandidateSyncLogs,
  diagnosticsForIntegration,
} from "./sheets-sync.server";

export const getIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminUser(context.userId);
    const integration = await getSavedGoogleIntegration({ userId: context.userId });
    return { integration, diagnostics: diagnosticsForIntegration(integration, null, { loggedUserId: context.userId }) };
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
    await assertAdminUser(context.userId);
    const integration = await saveGoogleIntegrationSettings({ ...data, user_id: context.userId });
    return { integration, diagnostics: diagnosticsForIntegration(integration, null, { loggedUserId: context.userId, saveSuccess: true, saveError: null }) };
  });

export const detectHeaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).optional().parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminUser(context.userId);
    const integration = await getSavedGoogleIntegration({ userId: context.userId });
    if (!integration?.spreadsheet_id) throw new Error("Google Sheet not configured");
    const sheetName = integration.sheet_name || "Form Responses 1";
    const headerRow = integration.header_row || 1;
    const values = await fetchSheetValues(integration.spreadsheet_id, sheetName);
    const headers = values[headerRow - 1] ?? [];
    const suggested = autoMap(headers);
    if (headers.length) {
      await saveDetectedHeaders(integration, suggested);
    }
    return { headers, suggested, diagnostics: diagnosticsForIntegration(integration, values) };
  });

export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fullHistory: z.boolean().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminUser(context.userId);
    if (data.fullHistory) {
      const integration = await getSavedGoogleIntegration({ userId: context.userId });
      if (!integration?.spreadsheet_id) throw new Error("Google Sheet not configured");
      await resetGoogleIntegrationSyncCursor(integration.id);
    }
    const result = await runCandidateSync({ fullHistory: !!data.fullHistory, triggeredBy: data.fullHistory ? "manual_full" : "manual", userId: context.userId });
    return result;
  });

export const getSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminUser(context.userId);
    return getCandidateSyncLogs();
  });
