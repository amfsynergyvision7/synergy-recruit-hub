import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail, textToHtml } from "./email.server";

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

    const result = await sendEmail({
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

export interface EmailMergeContext {
  company: string | null;
  position: string | null;
  ownerName: string | null;
}

// Feeds the {{company}}/{{position}}/{{signature}} placeholders in
// EmailComposeDialog's templates — {{name}} alone was enough for a generic
// "Hi {{name}}," but the selection-confirmation template needs to name the
// actual client and role, and sign off with whoever actually owns this
// lead, not a placeholder the recruiter has to remember to edit by hand.
export const getEmailMergeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ relatedTable: z.enum(EMAIL_RELATED_TABLES), relatedId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<EmailMergeContext> => {
    // Resolves a profile id to a human name, falling back to whoever is
    // actually composing this email when the record itself has no owner
    // set — so the signature is never blank just because a candidate or
    // client was never explicitly assigned to a recruiter.
    async function resolveOwnerName(profileId: string | null): Promise<string | null> {
      const id = profileId || context.userId;
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", id)
        .maybeSingle();
      return profile?.full_name || profile?.email || null;
    }

    if (data.relatedTable === "candidates") {
      const { data: candidate } = await context.supabase
        .from("candidates")
        .select("position_applied, assigned_recruiter")
        .eq("id", data.relatedId)
        .maybeSingle();

      // A candidate's most recent submission is the job/client this email
      // is actually about. The disambiguated embed names
      // (submissions_job_uuid_fkey / submissions_client_uuid_fkey) are
      // required the same way careers.functions.ts and
      // scheduling.functions.ts already need them — submissions carries
      // both a legacy and a live FK to job_openings/clients, so a plain
      // `job_openings(...)`/`clients(...)` embed is ambiguous to PostgREST.
      const { data: submission } = await context.supabase
        .from("submissions")
        .select(
          "role_title, job_openings!submissions_job_uuid_fkey(job_title), clients!submissions_client_uuid_fkey(company_name)",
        )
        .eq("candidate_uuid", data.relatedId)
        .order("submission_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sub = submission as any;
      return {
        company: sub?.clients?.company_name ?? null,
        // Prefers the job opening's current title, then the title snapshot
        // taken at submission time, then the candidate's own free-text
        // position_applied — in that order of "most likely still accurate".
        position: sub?.job_openings?.job_title || sub?.role_title || candidate?.position_applied || null,
        ownerName: await resolveOwnerName(candidate?.assigned_recruiter ?? null),
      };
    }

    // Clients: the record itself IS the company, and clients has no
    // assigned-recruiter column of its own — only created_by.
    const { data: client } = await context.supabase
      .from("clients")
      .select("company_name, created_by")
      .eq("id", data.relatedId)
      .maybeSingle();

    return {
      company: client?.company_name ?? null,
      position: null,
      ownerName: await resolveOwnerName(client?.created_by ?? null),
    };
  });