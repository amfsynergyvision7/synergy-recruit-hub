import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchCandidatesToJob, matchCandidateResume, generateResumeSummary } from "./ai.server";
import { runResumeDriveImport } from "./drive-import.server";

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