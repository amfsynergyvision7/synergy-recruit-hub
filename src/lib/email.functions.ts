import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail, textToHtml } from "./email.server";
import { assertApprovedRole } from "./access-gates.server";
import { assertExternalEffectReleased } from "./external-effects-hold.server";
import {
  assertCrmEmailAuditIntegrityReleased,
  confirmCrmEmailAuditReservation,
  confirmCrmEmailAuditSettlement,
  crmEmailDeliveryReconciliationError,
  crmEmailOutcomeStatus,
} from "./crm-email-audit-integrity.server";
import { isCrmEmailRecipientBound } from "./crm-email-recipient-policy";
import { assertCrmEmailRecordReadAccess } from "./crm-email-record-access.server";

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
    // A compile-time server release interlock precedes all SMTP, database
    // logging and recipient processing. No environment toggle bypasses it.
    assertExternalEffectReleased("crm_email");
    // Separate, immutable audit integrity hold: independent approval is
    // required even if the general SMTP release interlock is changed.
    assertCrmEmailAuditIntegrityReleased();
    // When reviewed for release, use the exact-one-role, approved+active
    // service-side gate rather than the old any-matching-role query.
    await assertApprovedRole(context.userId, ["admin", "recruiter"]);
    // A legitimate admin/recruiter may not use the SMTP relay to address
    // arbitrary third parties. Bind the recipient to an actually readable
    // candidate/client record, and bind recruiter access to ownership.
    const { data: memberships, error: membershipError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (membershipError || memberships?.length !== 1) {
      throw new Error("Email recipient authorization denied");
    }
    const role = memberships[0]?.role;
    if (role !== "admin" && role !== "recruiter") {
      throw new Error("Email recipient authorization denied");
    }

    let record: { email: string | null; assigned_recruiter?: string | null } | null;
    if (data.relatedTable === "candidates") {
      const { data: candidate, error: lookupError } = await context.supabase
        .from("candidates").select("email,assigned_recruiter")
        .eq("id", data.relatedId).maybeSingle();
      if (lookupError) throw new Error("Email recipient authorization denied");
      record = candidate;
    } else {
      const { data: client, error: lookupError } = await context.supabase
        .from("clients").select("email")
        .eq("id", data.relatedId).maybeSingle();
      if (lookupError) throw new Error("Email recipient authorization denied");
      record = client;
    }
    if (!isCrmEmailRecipientBound({
      relatedTable: data.relatedTable,
      requestedAddress: data.toEmail,
      record,
      actingUserId: context.userId,
      approvedRole: role,
    })) throw new Error("Email recipient authorization denied");

    // Require a committed, actor-bound journal reservation/readback BEFORE
    // the external SMTP side effect. The current database lacks a user
    // UPDATE policy, and the proposed RLS removes even INSERT: the separate
    // compile-time audit hold must remain until a reviewed RPC/outbox and
    // signed hosted UAT prove both stages and idempotency are safe.
    const attemptId = randomUUID();
    const { data: reserved, error: logError } = await context.supabase
      .from("email_log" as any)
      .insert({
        id: attemptId,
        related_table: data.relatedTable,
        related_id: data.relatedId,
        to_email: data.toEmail,
        subject: data.subject,
        body: data.body,
        status: "pending",
        error: null,
        provider_id: null,
        sent_by: context.userId,
      })
      .select("id,related_table,related_id,sent_by,status").single();
    if (logError) {
      // Neither provider details nor recipient/body values may enter logs.
      console.error("[email_log] insert failed; review restricted server diagnostics");
    }
    confirmCrmEmailAuditReservation({
      row: reserved, error: logError,
      expected: {
        id: attemptId, actorId: context.userId,
        relatedTable: data.relatedTable, relatedId: data.relatedId,
      },
    });

    // Provider errors and process interruptions have unknown outcomes.
    // Never automatically retry or claim definite non-delivery.
    let result: { success: boolean; providerId?: string; error?: string } = {
      success: false,
    };
    try {
      result = await sendEmail({
        to: data.toEmail,
        subject: data.subject,
        html: textToHtml(data.body),
      });
    } catch {
      // Keep this attempt in the audit journal for manual reconciliation.
    }
    const finalStatus = crmEmailOutcomeStatus(result);
    const providerId = typeof result.providerId === "string" &&
      result.providerId.length <= 256 ? result.providerId : null;
    const { data: finalized, error: settlementError } = await context.supabase
      .from("email_log" as any)
      .update({
        status: finalStatus,
        error: finalStatus === "unknown"
          ? "Delivery outcome unconfirmed; manual reconciliation required"
          : null,
        provider_id: finalStatus === "sent" ? providerId : null,
      })
      .eq("id", attemptId)
      .eq("sent_by", context.userId)
      .eq("status", "pending")
      .select("id,status").maybeSingle();
    if (settlementError) {
      console.error("[email_log] update failed; review restricted server diagnostics");
    }
    confirmCrmEmailAuditSettlement({
      row: finalized, error: settlementError,
      expected: { id: attemptId, status: finalStatus },
    });
    if (finalStatus !== "sent") throw crmEmailDeliveryReconciliationError();
    return { success: true };
  });

export const listEmailHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ relatedTable: z.enum(EMAIL_RELATED_TABLES), relatedId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertApprovedRole(context.userId, ["admin", "recruiter"]);
    // Verify record ownership separately from the user's broad role, before
    // disclosing correspondence or template merge details for this ID.
    await assertCrmEmailRecordReadAccess({
      supabase: context.supabase,
      actorId: context.userId,
      relatedTable: data.relatedTable,
      relatedId: data.relatedId,
    });
    const { data: rows, error } = await context.supabase
      .from("email_log" as any)
      .select("id,subject,status,created_at,to_email")
      .eq("related_table", data.relatedTable)
      .eq("related_id", data.relatedId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Email history is unavailable");
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
    await assertApprovedRole(context.userId, ["admin", "recruiter"]);
    // Verify record ownership separately from the user's broad role, before
    // disclosing correspondence or template merge details for this ID.
    await assertCrmEmailRecordReadAccess({
      supabase: context.supabase,
      actorId: context.userId,
      relatedTable: data.relatedTable,
      relatedId: data.relatedId,
    });
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