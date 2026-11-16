import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, textToHtml } from "./email.server";
import { assertApprovedRole } from "./access-gates.server";
import { assertExternalEffectReleased } from "./external-effects-hold.server";
import {
  assertCrmEmailAuditIntegrityReleased,
  executeCrmEmailAuditProtocol,
  isCrmEmailRequestId,
} from "./crm-email-audit-integrity.server";
import { assertCrmEmailReconciliationReleased } from "./crm-email-reconciliation-hold.server";
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
      requestId: z.string().uuid().refine(isCrmEmailRequestId, "Invalid email attempt key"),
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
    // Reuse the caller's stable request UUID as email_log's existing PRIMARY
    // KEY. Concurrent/replayed requests with the same ID cannot reserve
    // another audit row or invoke SMTP after a database duplicate-key error.
    // No conflict-upsert or SELECT-existing-then-send race is allowed.
    const attemptId = data.requestId;
    return await executeCrmEmailAuditProtocol({
      attempt: {
        id: attemptId,
        actorId: context.userId,
        relatedTable: data.relatedTable,
        relatedId: data.relatedId,
      },
      reserve: async () => {
        // Server-only service-role RPC; browser tokens cannot execute it.
        // Both immutable external-effect holds and all user/record/recipient
        // authorization checks have already succeeded above this call.
        // The RPC independently revalidates actor/role/record/recipient.
        const { data: rows, error: logError } = await (supabaseAdmin.rpc as any)(
          "crm_email_reserve_trusted", {
            p_attempt: attemptId,
            p_actor: context.userId,
            p_table: data.relatedTable,
            p_record: data.relatedId,
            p_recipient: data.toEmail,
            p_subject: data.subject,
            p_body: data.body,
          },
        );
        if (logError) {
          console.error("[email_log] insert failed; review restricted server diagnostics");
        }
        const reserved = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
        return { row: reserved, error: logError };
      },
      deliver: () => sendEmail({
        to: data.toEmail,
        subject: data.subject,
        html: textToHtml(data.body),
      }),
      settle: async (finalStatus, providerId) => {
        // Only the service-role RPC can transition this exact pending row.
        // Never retry provider delivery if the journal update is uncertain.
        const { data: rows, error: settlementError } = await (supabaseAdmin.rpc as any)(
          "crm_email_settle_trusted", {
            p_attempt: attemptId,
            p_actor: context.userId,
            p_status: finalStatus,
            p_provider_id: providerId,
          },
        );
        if (settlementError) {
          console.error("[email_log] update failed; review restricted server diagnostics");
        }
        const finalized = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
        return { row: finalized, error: settlementError };
      },
    });
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
/** Build160: independently held administrator-only, provider-verified
 * confirmation. This endpoint never invokes sendEmail.
 */
export const confirmCrmEmailSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input:unknown) =>
    z.object({
      attemptId: z.string().uuid().refine(isCrmEmailRequestId),
      caseReference: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{9,119}$/),
      providerId: z.string().min(1).max(256).regex(/^[!-~]+$/),
    }).strict().parse(input),
  )
  .handler(async ({ context,data }) => {
    assertCrmEmailReconciliationReleased();
    await assertApprovedRole(context.userId, ["admin"]);
    const { data: rows,error } = await (supabaseAdmin.rpc as any)(
      "crm_email_confirm_sent_trusted", {
        p_attempt: data.attemptId,
        p_admin: context.userId,
        p_case_ref: data.caseReference,
        p_provider_id: data.providerId,
      },
    );
    if (error || !Array.isArray(rows) || rows.length!==1 ||
        rows[0]?.id!==data.attemptId || rows[0]?.status!=="sent")
      throw new Error("CRM email reconciliation unavailable; release remains paused");
    return { confirmed:true } as const;
  });
