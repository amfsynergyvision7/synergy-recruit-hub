// Public, unauthenticated endpoints behind the /careers pages — a candidate
// reaches these with no CRM account, exactly like step 3's scheduling links,
// so every function here uses supabaseAdmin (service role) rather than the
// user's own client: there is no Supabase session for RLS to evaluate. No
// RLS policy changes were needed on job_openings/candidates/submissions for
// this reason — see the migration's header comment.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeEmail, normalizePhone } from "@/lib/dedupe";

function maskCompanyName(row: { is_confidential: boolean; clients?: { company_name?: string } | null }): string | null {
  if (row.is_confidential) return null;
  return row.clients?.company_name ?? null;
}

// ---- Public list: every currently-open job, for the /careers index ----
export const listOpenJobs = createServerFn({ method: "POST" }).handler(async () => {
  // clients is joined the same disambiguated way interviews/offers already
  // do (job_openings has both a legacy client_id and the live client_uuid,
  // both FKs to clients, so a plain embed is ambiguous to PostgREST).
  const { data, error } = await supabaseAdmin
    .from("job_openings")
    .select("id, job_title, location, priority, open_positions, is_confidential, created_at, clients!job_openings_client_uuid_fkey(company_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

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
    const { data: job, error } = await supabaseAdmin
      .from("job_openings")
      .select("id, job_title, location, description, requirements, salary_min, salary_max, open_positions, priority, status, is_confidential, clients!job_openings_client_uuid_fkey(company_name)")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error || !job) throw new Error("This posting isn't available.");

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

// ---- Public apply: creates (or reuses) a candidate, then a submission ----
// tied to this job — the same shape a recruiter creates by hand today, just
// candidate-initiated. Deliberately no resume file upload here: resumes
// elsewhere in this app are a URL (resume_url), populated via Drive import
// rather than Supabase Storage, and adding a *new*, publicly-writable
// Storage bucket for anonymous uploads is both a fresh paid-tier surface and
// an abuse vector this prototype doesn't need yet — a pasted Drive/Dropbox
// link fills the same field.
export const submitJobApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: job, error: jobError } = await supabaseAdmin
      .from("job_openings")
      .select("id, job_title, status, assigned_recruiter")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jobError || !job) throw new Error("This posting couldn't be found.");
    if (job.status !== "open") throw new Error("This position is no longer accepting applications.");

    const email = normalizeEmail(data.email)!;
    const mobileLast10 = normalizePhone(data.mobile);

    // Reuse an existing candidate record rather than creating a duplicate —
    // the same normalization dedupe.ts already uses for Drive import and
    // the Duplicate Candidates tool, so a candidate who applied before (or
    // was already in the pipeline from another source) is recognized here
    // too. Matched on email first (the more reliable signal), then mobile.
    let candidateId: string | null = null;
    const { data: byEmail } = await supabaseAdmin
      .from("candidates").select("id").ilike("email", email).limit(1).maybeSingle();
    if (byEmail) {
      candidateId = byEmail.id;
    } else if (mobileLast10) {
      const { data: mobileMatches } = await supabaseAdmin
        .from("candidates").select("id, mobile").ilike("mobile", `%${mobileLast10}%`);
      candidateId = (mobileMatches ?? []).find((c: any) => normalizePhone(c.mobile) === mobileLast10)?.id ?? null;
    }

    if (!candidateId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("candidates")
        .insert({
          full_name: data.fullName,
          email: data.email,
          mobile: data.mobile,
          current_company: data.currentCompany || null,
          experience_years: data.experienceYears ?? null,
          expected_salary: data.expectedSalary ?? null,
          notice_period: data.noticePeriod || null,
          resume_url: data.resumeUrl || null,
          position_applied: job.job_title,
          source: "career_page",
          assigned_recruiter: job.assigned_recruiter,
          stage: "lead_received",
          status: "active",
        })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      candidateId = created.id;
    }

    // One application per candidate per job — a second submit (someone
    // double-clicking, or re-applying to a posting they already sent) is a
    // friendly no-op rather than a duplicate submissions row.
    const { data: existingSubmission } = await supabaseAdmin
      .from("submissions").select("id")
      .eq("candidate_uuid", candidateId).eq("job_uuid", job.id)
      .maybeSingle();
    if (existingSubmission) {
      return { alreadyApplied: true };
    }

    // client_id/client_uuid/job_id are deliberately left unset here —
    // submissions has its own normalize_submission_relationships() BEFORE
    // INSERT trigger that fills those in from candidate_uuid/job_uuid, and
    // even derives client_uuid from the job's own client automatically, so
    // there's no room for the two to drift by duplicating that lookup here.
    // candidate_id is still supplied (the legacy column is NOT NULL with no
    // DB-level default the generated types can see) — the trigger would set
    // it from candidate_uuid regardless, this just satisfies the type.
    const { data: submission, error: subError } = await supabaseAdmin
      .from("submissions")
      .insert({
        candidate_id: candidateId,
        candidate_uuid: candidateId,
        job_uuid: job.id,
        role_title: job.job_title,
        status: "submitted",
        remarks: data.coverNote || null,
      })
      .select("id")
      .single();
    if (subError) throw new Error(subError.message);

    // Best-effort nudge to whoever owns this req, through the same
    // notifications feed every other automated event in this app already
    // uses — never blocks the candidate's own success response.
    if (job.assigned_recruiter) {
      await supabaseAdmin.from("notifications").insert({
        user_id: job.assigned_recruiter,
        title: `New application: ${data.fullName}`,
        message: `${data.fullName} applied for "${job.job_title}" via the careers page.`,
        type: "new_application",
        related_table: "submissions",
        related_id: submission.id,
      });
    }

    return { alreadyApplied: false };
  });