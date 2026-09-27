import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchCandidatesToJob } from "./ai.server";

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