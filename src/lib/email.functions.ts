import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendViaResend, textToHtml } from "./email.server";

// Which CrudModule tables can currently send email from their row actions
// (Candidates, Clients — see emailField on those two route configs). Kept as
// an explicit allowlist rather than accepting any string so a stray typo in
// a future module config fails loudly instead of quietly logging garbage
// into email_log.related_table.
const EMAIL_RELATED_TABLES = ["candidates", "clients"] as const;

export const sendCrmEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      relatedTable: z.enum(EMAIL_RELATED_TABLES),
      relatedId: z.string().uuid(),
      toEmail: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(10000),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Defense in depth: the UI only shows the Mail button when canEdit()
    // already says this role can edit Candidates/Clients (admin or
    // recruiter), but a server function is callable directly, and the
    // email_log RLS insert policy alone isn't enough to stop this — that
    // only blocks the LOG write, and by then a real email would already be
    // on its way to a real person. So the same admin/recruiter check is
    // enforced here too, before anything is sent.
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "recruiter");
    if (!allowed) {
      throw new Error("Only an admin or recruiter can send email from the CRM.");
    }

    const result = await sendViaResend({
      to: data.toEmail,
      subject: data.subject,
      html: textToHtml(data.body),
    });

    // Log the attempt either way — a failed send (e.g. domain not verified
    // yet) is exactly as useful to see in the record's correspondence history
    // as a successful one, so nobody re-sends the same email twice thinking
    // the first one silently vanished.
    const { error: logError } = await context.supabase.from("email_log" as any).insert({
      related_table: data.relatedTable,
      related_id: data.relatedId,
      to_email: data.toEmail,
      subject: data.subject,
      body: data.body,
      status: result.success ? "sent" : "failed",
      error: result.error ?? null,
      provider_id: result.providerId ?? null,
      sent_by: context.userId,
    });
    if (logError) {
      // Don't mask a real send failure behind a logging failure, but do
      // surface both if the send itself also failed.
      console.error("[email_log] insert failed:", logError.message);
    }

    if (!result.success) {
      throw new Error(result.error ?? "Email failed to send for an unknown reason.");
    }
    return { success: true };
  });

export const listEmailHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ relatedTable: z.enum(EMAIL_RELATED_TABLES), relatedId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("email_log" as any)
      .select("*")
      .eq("related_table", data.relatedTable)
      .eq("related_id", data.relatedId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });