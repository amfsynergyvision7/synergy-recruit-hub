import { supabase } from "@/integrations/supabase/client";
import { LEGACY_CANDIDATE_WRITES_PAUSED, CANDIDATE_MUTATION_HOLD_REASON } from "@/lib/release-safety";

// Review-only client. The future release requires a hosted migration and
// independent signed-user/browser UAT before the unconditional hold is removed.
export const REVIEWABLE_STAGE_TARGETS = [
  "lead_received", "contacted", "interested", "resume_collected",
  "interview_completed", "selected", "rejected", "dropped",
] as const;
const targetSet = new Set<string>(REVIEWABLE_STAGE_TARGETS);
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export const isReviewableStageTarget = (value: string) => targetSet.has(value);

type StageError = { message: string } | null;
type StageRpcClient = {
  rpc(name: "crm_change_candidate_stage", args: {
    p_candidate_id: string; p_expected_stage: string; p_new_stage: string;
  }): Promise<{ data: unknown; error: StageError }>;
};
const rpc = supabase as unknown as StageRpcClient;

export async function changeCandidateStage(input: {
  candidateId: string; expectedStage: string; newStage: string;
}): Promise<{ error: StageError }> {
  if (LEGACY_CANDIDATE_WRITES_PAUSED) {
    return { error: { message: CANDIDATE_MUTATION_HOLD_REASON } };
  }
  if (!UUID.test(input.candidateId)
      || !input.expectedStage || !isReviewableStageTarget(input.newStage)
      || input.expectedStage === "joined") {
    return { error: { message: "This stage transition is not authorized for the current release" } };
  }
  // No direct .from("candidates").update() from the board.
  // Backend must derive actor from auth.uid(), lock row, enforce ownership,
  // verify old stage, and atomically audit. Browser role is never trusted.
  const { error } = await rpc.rpc("crm_change_candidate_stage", {
    p_candidate_id: input.candidateId,
    p_expected_stage: input.expectedStage,
    p_new_stage: input.newStage,
  });
  return { error };
}
