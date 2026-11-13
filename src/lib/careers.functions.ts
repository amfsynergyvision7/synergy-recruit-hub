// Public, unauthenticated endpoints behind the /careers pages — a candidate
// reaches these with no CRM account, exactly like step 3's scheduling links,
// so every function here uses supabaseAdmin (service role) rather than the
// user's own client: there is no Supabase session for RLS to evaluate. No
// RLS policy changes were needed on job_openings/candidates/submissions for
// this reason — see the migration's header comment.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertExternalEffectReleased } from "./external-effects-hold.server";

function maskCompanyName(row: { is_confidential: boolean; clients?: { company_name?: string } | null }): string | null {
  if (row.is_confidential) return null;
  return row.clients?.company_name ?? null;
}

// ---- Public list: every currently-open job, for the /careers index ----
export const listOpenJobs = createServerFn({ method: "POST" }).handler(async () => {
  assertExternalEffectReleased("careers_publication");
  // clients is joined the same disambiguated way interviews/offers already
  // do (job_openings has both a legacy client_id and the live client_uuid,
  // both FKs to clients, so a plain embed is ambiguous to PostgREST).
  const { data, error } = await supabaseAdmin
    .from("job_openings")
    .select("id, job_title, location, priority, open_positions, is_confidential, created_at, clients!job_openings_client_uuid_fkey(company_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  // Public errors must not echo PostgREST SQL or backend diagnostics.
  if (error) throw new Error("Career postings are temporarily unavailable.");

  return (data ?? []).map((row: any) => ({
    id: row.id,
    jobTitle: row.job_title,
    location: row.location,
    priority: row.priority,
    openPositions: row.open_positions,
    companyName: maskCompanyName(row),
  }));
});

// ---- Public detail: one job's full posting, for /careers/$jobId ----
export const getJobDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    assertExternalEffectReleased("careers_publication");
    const { data: job, error } = await supabaseAdmin
      .from("job_openings")
      .select("id, job_title, location, description, requirements, salary_min, salary_max, open_positions, priority, status, is_confidential, clients!job_openings_client_uuid_fkey(company_name)")
      .eq("id", data.jobId)
      .eq("status", "open")
      .maybeSingle();
    // Keep the "not found" case generic (a stale/guessed link shouldn't leak
    // anything), but surface the real Postgrest message when the query
    // itself failed (missing column, broken embed, bad env var) — those
    // used to render identically, which made a genuine outage on this page
    // indistinguishable from someone just following an old link.
    if (error) throw new Error("This posting isn't available.");
    if (!job) throw new Error("This posting isn't available.");

    return {
      id: job.id,
      jobTitle: job.job_title,
      location: job.location,
      description: job.description,
      requirements: job.requirements,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      openPositions: job.open_positions,
      priority: job.priority,
      isOpen: job.status === "open",
      companyName: maskCompanyName(job as any),
    };
  });

const applicationSchema = z.object({
  jobId: z.string().uuid(),
  // No verifier or proof issuer is implemented in Build104: optional here
  // for read-only UI compatibility; always required by the handler to write.
  verificationId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Enter your full name.").max(200),
  email: z.string().trim().email("Enter a valid email address."),
  mobile: z.string().trim().min(7, "Enter a valid mobile number.").max(20),
  currentCompany: z.string().trim().max(200).optional(),
  experienceYears: z.number().min(0).max(60).optional(),
  expectedSalary: z.number().min(0).optional(),
  noticePeriod: z.string().trim().max(100).optional(),
  resumeUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
  coverNote: z.string().trim().max(2000).optional(),
});

// ---- Public apply: verification proof + atomic candidate/submission RPC ----
// No actual proof issuer exists. Release holds are unconditional. This path
// cannot create orphan candidates on partial submission failure, and public
// applicants cannot claim existing CRM identities by giving contact details.
export const submitJobApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    // Anonymous application writes use a service-role database client.
    // No feature flag or deployment environment can bypass this review hold.
    assertExternalEffectReleased("public_application");
    if (!data.verificationId) {
      throw new Error("Application requires independent identity verification");
    }
    // Single server-only RPC. No separate service-role candidate/submission
    // writes are possible in this public handler, even if an outer release
    // hold were accidentally removed. The review-only SQL requires a single-
    // use, independently issued email+mobile proof and transactionally writes
    // both rows. No proof issuer exists in Build104, so this cannot be live.
    const { data: outcome, error } = await (supabaseAdmin as any).rpc(
      "crm_commit_verified_public_application",
      {
        p_proof_id: data.verificationId,
        p_job_id: data.jobId,
        p_full_name: data.fullName,
        p_email: data.email,
        p_mobile: data.mobile,
        p_current_company: data.currentCompany || null,
        p_experience_years: data.experienceYears ?? null,
        p_expected_salary: data.expectedSalary ?? null,
        p_notice_period: data.noticePeriod || null,
        p_resume_url: data.resumeUrl || null,
        p_cover_note: data.coverNote || null,
      },
    );
    // Never relay the raw PostgREST/trigger error or candidate/submission IDs.
    if (error || (outcome !== "accepted" && outcome !== "already_applied")) {
      throw new Error("Application could not be completed securely.");
    }
    return { alreadyApplied: outcome === "already_applied" };
  });