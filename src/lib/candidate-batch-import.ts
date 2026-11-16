import { supabase } from "@/integrations/supabase/client";
import { LEGACY_BULK_IMPORT_WRITES_PAUSED, BULK_IMPORT_HOLD_REASON } from "@/lib/release-safety";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const allowed = new Set([
  "full_name","mobile","email","location","position_applied","current_company",
  "experience_years","current_salary","expected_salary","notice_period",
  "resume_url","source","notes",
]);

export type AtomicImportResult = {
  status: "created" | "replayed";
  count: number;
  candidate_ids: string[];
};
type RpcError = { message: string } | null;
type ImportRpcClient = {
  rpc(name: "crm_import_candidates_atomic", args: {
    p_request_id: string;
    p_assigned_recruiter: string;
    p_rows: Record<string, unknown>[];
  }): Promise<{ data: unknown; error: RpcError }>;
};
const rpc = supabase as unknown as ImportRpcClient;

export async function commitCandidateImport(input: {
  requestId: string;
  assignedRecruiter: string;
  rows: Record<string, unknown>[];
}): Promise<{ data: AtomicImportResult | null; error: RpcError }> {
  // Always held on the review branch. This flag must never become an env var.
  if (LEGACY_BULK_IMPORT_WRITES_PAUSED) {
    return { data: null, error: { message: BULK_IMPORT_HOLD_REASON } };
  }
  if (!UUID.test(input.requestId) || !UUID.test(input.assignedRecruiter)
      || !Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 50
      || input.rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)
        || !Object.keys(r).length
        || Object.keys(r).some((k) => !allowed.has(k)))
      || JSON.stringify(input.rows).length > 200000) {
    return { data: null, error: { message: "Unsupported or oversized candidate import batch" } };
  }
  // Preserve the requestId for retries: a network timeout is NOT proof of
  // failure, and generating a new key could duplicate successful writes.
  const { data, error } = await rpc.rpc("crm_import_candidates_atomic", {
    p_request_id: input.requestId,
    p_assigned_recruiter: input.assignedRecruiter,
    p_rows: input.rows,
  });
  if (error) return { data: null, error };
  if (!data || typeof data !== "object") {
    return { data: null, error: { message: "Atomic import returned an unknown outcome; retry same request ID" } };
  }
  const result = data as Partial<AtomicImportResult>;
  if ((result.status !== "created" && result.status !== "replayed")
       || result.count !== input.rows.length
       || !Array.isArray(result.candidate_ids)
       || result.candidate_ids.length !== input.rows.length
       || !result.candidate_ids.every((id) => typeof id === "string" && UUID.test(id))) {
    return { data: null, error: { message: "Atomic import confirmation is incomplete; retry same request ID" } };
  }
  return { data: result as AtomicImportResult, error: null };
}
