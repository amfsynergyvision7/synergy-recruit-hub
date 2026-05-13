import { createFileRoute } from "@tanstack/react-router";
import { runCandidateSync } from "@/lib/sheets-sync.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/sheets-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { data: integ } = await supabaseAdmin
            .from("integrations").select("auto_sync, spreadsheet_id").eq("module", "candidates").maybeSingle();
          if (!integ?.auto_sync || !integ?.spreadsheet_id) {
            return Response.json({ skipped: true, reason: "auto_sync disabled or sheet not configured" });
          }
          const result = await runCandidateSync({ triggeredBy: "cron" });
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          await supabaseAdmin.from("sync_logs").insert({
            module: "candidates", triggered_by: "cron", status: "error",
            message: e?.message || String(e), errors: [{ row: 0, message: e?.message || String(e) }],
          });
          return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
        }
      },
    },
  },
});
