/**
 * Build134: read-only, count-reconciled recruiter choices for candidate forms.
 * This is a narrow personnel selector, NOT the private administrator directory.
 * Backend RLS must authorize all role and profile metadata independently.
 */
import { readBoundedReportRows, type ReportPageReader } from "./bounded-report-read.ts";

export const RECRUITER_PROFILE_BATCH_SIZE = 100 as const;

export type RecruiterRole = { id: string; user_id: string; role: string };
export type RecruiterProfile = { id: string; full_name: string };
export type RecruiterChoice = { value: string; label: string };
export type RecruiterProfileBatchReader = (
  ids: readonly string[], signal: AbortSignal,
) => PromiseLike<{
  data: RecruiterProfile[] | null; count: number | null; error: unknown;
}> | Promise<{
  data: RecruiterProfile[] | null; count: number | null; error: unknown;
}>;

function abortIfCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new Error("Recruiter selector request cancelled");
}

/**
 * Two strictly bounded operations: a verified complete set of recruiter
 * roles, followed by verified count-exact batches of eligible, active and
 * approved profile display labels. Missing profiles may be suspended or
 * pending and must not be offered as assignees.
 *
 * Never return half a selector if a later page or batch fails.
 */
export async function readVerifiedRecruiterChoices(
  readRoles: ReportPageReader<RecruiterRole>,
  readApprovedProfiles: RecruiterProfileBatchReader,
  signal: AbortSignal,
): Promise<RecruiterChoice[]> {
  abortIfCancelled(signal);
  const roles = await readBoundedReportRows(readRoles, signal);
  const userIds = new Set<string>();
  for (const row of roles) {
    if (row.role !== "recruiter" || typeof row.user_id !== "string" ||
        !row.user_id.trim() || userIds.has(row.user_id))
      throw new Error("Recruiter role identity cannot be verified");
    userIds.add(row.user_id);
  }
  const ids = [...userIds].sort();
  const result: RecruiterChoice[] = [];
  const seen = new Set<string>();
  for (let start = 0; start < ids.length; start += RECRUITER_PROFILE_BATCH_SIZE) {
    abortIfCancelled(signal);
    const chunk = ids.slice(start, start + RECRUITER_PROFILE_BATCH_SIZE);
    const reply = await readApprovedProfiles(chunk, signal);
    abortIfCancelled(signal);
    if (reply.error || !Array.isArray(reply.data) ||
        !Number.isSafeInteger(reply.count) || reply.count! < 0 ||
        reply.count! > chunk.length || reply.data.length !== reply.count)
      throw new Error("Recruiter profile choices cannot be verified");
    const expected = new Set(chunk);
    for (const row of reply.data) {
      if (!row || typeof row.id !== "string" ||
          !expected.has(row.id) || seen.has(row.id) ||
          typeof row.full_name !== "string")
        throw new Error("Recruiter profile identity is inconsistent");
      seen.add(row.id);
      result.push({ value: row.id, label: row.full_name.trim() || row.id.slice(0, 8) });
    }
  }
  return result.sort((a,b)=>
    a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}
