import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SLOT_FORMAT, splitSlot } from "./scheduling";

// ---- Recruiter-side: create/replace the proposed slots for one interview ----
// Authenticated, same admin-or-recruiter rule as everything else on the
// Interviews module (see canEdit() in use-auth.tsx) — enforced here too, not
// just in the UI, for the same reason email.functions.ts checks it directly:
// a server function is callable on its own, independent of what button the
// UI happens to show.
export const createSchedulingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      interviewId: z.string().uuid(),
      slots: z.array(z.string().regex(SLOT_FORMAT)).min(1).max(3),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "recruiter");
    if (!allowed) throw new Error("Only an admin or recruiter can send a scheduling link.");

    const { data: existing, error: fetchError } = await context.supabase
      .from("interviews")
      .select("id, scheduling_token")
      .eq("id", data.interviewId)
      .maybeSingle();
    if (fetchError || !existing) throw new Error("That interview record couldn't be found.");

    const token = existing.scheduling_token ?? crypto.randomUUID();
    const { error } = await context.supabase
      .from("interviews")
      .update({ scheduling_token: token, proposed_slots: data.slots, status: "awaiting_candidate" })
      .eq("id", data.interviewId);
    if (error) throw new Error(error.message);

    return { token };
  });

// ---- Candidate-facing: no auth (the candidate has no CRM account) ----
// Both functions below authenticate purely by knowledge of the token — the
// same trust model as any "reset your password" email link — and use
// supabaseAdmin (service role, bypasses RLS) since an anonymous visitor has
// no Supabase session/JWT at all for RLS to evaluate. Nothing here selects or
// returns more than the few fields the public page actually needs to render.
export const getSchedulingInfo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // interviews has two foreign keys each to candidates (candidate_id AND
    // candidate_uuid) and to clients (client_id AND client_uuid) — a plain
    // `candidates(...)`/`clients(...)` embed is ambiguous to PostgREST and
    // errors with "more than one relationship was found"; naming the exact
    // constraint (the *_uuid one, which is what this app's own code treats as
    // the live FK — see _app.interviews.tsx's relation config) is required.
    // A concatenated ("a" + "b") select string defeats supabase-js's
    // literal-type parsing (it falls back to an untyped GenericStringError
    // result) — has to stay one unbroken string literal for the typed
    // columns below to resolve correctly.
    const { data: interview, error } = await supabaseAdmin
      .from("interviews")
      .select("id, round, mode, status, interview_date, interview_time, proposed_slots, candidates!interviews_candidate_uuid_fkey(full_name), clients!interviews_client_uuid_fkey(company_name)")
      .eq("scheduling_token", data.token)
      .maybeSingle();
    if (error || !interview) throw new Error("This scheduling link isn't valid.");

    return {
      candidateName: (interview as any).candidates?.full_name ?? "there",
      companyName: (interview as any).clients?.company_name ?? null,
      round: interview.round,
      mode: interview.mode,
      status: interview.status,
      confirmedDate: interview.interview_date,
      confirmedTime: interview.interview_time,
      proposedSlots: (interview.proposed_slots as string[] | null) ?? [],
    };
  });

export const confirmSchedulingSlot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().uuid(), slot: z.string().regex(SLOT_FORMAT) }).parse(input))
  .handler(async ({ data }) => {
    const { data: interview, error } = await supabaseAdmin
      .from("interviews")
      .select("id, status, proposed_slots, candidate_uuid, candidates!interviews_candidate_uuid_fkey(full_name, assigned_recruiter)")
      .eq("scheduling_token", data.token)
      .maybeSingle();
    if (error || !interview) throw new Error("This scheduling link isn't valid.");
    if (interview.status !== "awaiting_candidate") {
      throw new Error("This interview has already been confirmed or is no longer awaiting a response.");
    }
    const slots = (interview.proposed_slots as string[] | null) ?? [];
    if (!slots.includes(data.slot)) {
      throw new Error("That time slot is no longer available — please ask for a fresh link.");
    }

    const { date, time } = splitSlot(data.slot);
    const { error: updateError } = await supabaseAdmin
      .from("interviews")
      .update({ interview_date: date, interview_time: time, status: "scheduled" })
      .eq("id", interview.id);
    if (updateError) throw new Error(updateError.message);

    // Nice-to-have close-the-loop touch: ping the assigned recruiter through
    // the same reminders feed from step 1, rather than them only noticing the
    // next time they happen to reopen the Interviews page. Best-effort — a
    // failure here shouldn't undo the confirmation that already succeeded.
    const candidate = (interview as any).candidates;
    if (candidate?.assigned_recruiter) {
      await supabaseAdmin.from("notifications").insert({
        user_id: candidate.assigned_recruiter,
        title: `Interview confirmed: ${candidate.full_name}`,
        message: `${candidate.full_name} picked a time via their scheduling link.`,
        type: "interview_confirmed",
        related_table: "interviews",
        related_id: interview.id,
      });
    }

    return { confirmedDate: date, confirmedTime: time };
  });