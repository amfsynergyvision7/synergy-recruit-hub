import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchCandidatesToJob, matchCandidateResume } from "./ai.server";

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