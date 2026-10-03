import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  matchCandidatesToJob,
  matchCandidateResume,
  generateResumeSummary,
  generateCandidateAtsScore,
  restructureResumeForClient,
} from "./ai.server";
import { runResumeDriveImport } from "./drive-import.server";
import { buildClientResumePdf, fetchLogoBuffer } from "./resume-pdf.server";

export const matchCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // No extra role gate beyond "signed in and approved" (already enforced
    // by requireSupabaseAuth + the candidates/job_openings RLS policies
    // context.supabase reads through) — this is a read-only insight, not a
    // write, so anyone who can already see the pipeline can ask for a match.
    return matchCandidatesToJob(context.supabase, data.jobId);
  });

// Deep, one-candidate match: fetches the candidate's actual resume from their
// Drive link, parses it, and scores it against the job. Slower than the bulk
// match above (a real file download + parse per call), which is why it's a
// separate, explicitly-triggered action rather than folded into every bulk run.
export const matchCandidateWithResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ jobId: z.string().uuid(), candidateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    return matchCandidateResume(context.supabase, data.jobId, data.candidateId);
  });

// Standalone resume summary (no job involved) — manually triggered from a
// button on the Candidates page. Writes candidates.resume_summary.
export const generateCandidateResumeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    return generateResumeSummary(context.supabase, data.candidateId);
  });

// ATS compatibility checker — manually triggered from a button on the
// Candidates page. Reads the candidate's actual resume file, scores its ATS
// readability, and saves the result (candidates.ats_score/ats_issues/
// ats_checked_at) so it's visible on the record without re-checking.
export const generateCandidateAtsScoreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    return generateCandidateAtsScore(context.supabase, data.candidateId);
  });

// Client-ready resume PDF — restructures the candidate's actual resume via
// Gemini into a clean, single-column, agency-branded shape, then renders it
// to a PDF server-side (pdfkit) and hands back the bytes as base64 for the
// browser to turn into a download, the same way nothing here ever persists
// the generated file (same zero-persistence spirit as fetchResumeText).
export const generateClientResumePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { candidate, resume } = await restructureResumeForClient(context.supabase, data.candidateId);

    const { data: settings } = await context.supabase
      .from("app_settings")
      .select("logo_url")
      .eq("id", 1)
      .maybeSingle();
    const logoBuffer = await fetchLogoBuffer(settings?.logo_url ?? null);

    const pdfBuffer = await buildClientResumePdf({
      fullName: candidate.full_name,
      email: candidate.email,
      mobile: candidate.mobile,
      location: candidate.location,
      positionApplied: candidate.position_applied,
      logoBuffer,
      resume,
    });

    const safeName = candidate.full_name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "candidate";
    return { base64: pdfBuffer.toString("base64"), filename: `${safeName}_resume.pdf` };
  });

// Bulk "Check Google Drive for new resumes" — scans the one shared folder
// configured in Settings, skips anything already imported, and creates/
// updates candidates from the rest. No input: the folder to scan comes from
// app_settings, not from the caller, so this can't be pointed at an
// arbitrary folder by manipulating the request.
export const checkDriveForNewResumes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runResumeDriveImport(context.supabase);
  });