import { supabase } from "@/integrations/supabase/client";
import { LEGACY_CANDIDATE_WRITES_PAUSED, CANDIDATE_MUTATION_HOLD_REASON } from "@/lib/release-safety";

/** Review-only candidate create/detail edits; stage and deletion use separate flows. */
const candidateFields = new Set([
  "full_name","mobile","email","location","position_applied","current_company",
  "experience_years","current_salary","expected_salary","notice_period",
  "resume_url","source","notes","assigned_recruiter",
]);
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
type RpcError = { message: string } | null;
type CandidateRpcClient = {
  rpc(name: "crm_write_candidate", args: {
    p_candidate_id: string | null;
    p_expected_updated_at: string | null;
    p_fields: Record<string, unknown>;
  }): Promise<{ data: unknown; error: RpcError }>;
};
const rpc = supabase as unknown as CandidateRpcClient;

export async function saveCandidateRecord(input: {
  candidateId: string | null;
  expectedUpdatedAt: string | null;
  fields: Record<string, unknown>;
}): Promise<{ error: RpcError }> {
  if (LEGACY_CANDIDATE_WRITES_PAUSED) {
    return { error: { message: CANDIDATE_MUTATION_HOLD_REASON } };
  }
  if ((input.candidateId !== null && !UUID.test(input.candidateId))
      || (input.candidateId !== null && !input.expectedUpdatedAt)
      || (input.candidateId === null && input.expectedUpdatedAt !== null)
      || Object.keys(input.fields).length === 0
      || Object.keys(input.fields).some((key) => !candidateFields.has(key))
      || JSON.stringify(input.fields).length > 16000) {
    return { error: { message: "Candidate request has unsupported or missing fields" } };
  }
  // Do not send stage, status, generated codes, ATS results or created_by from
  // the browser. SQL independently checks the signed user and field allowlist.
  const { error } = await rpc.rpc("crm_write_candidate", {
    p_candidate_id: input.candidateId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_fields: input.fields,
  });
  return { error };
}
