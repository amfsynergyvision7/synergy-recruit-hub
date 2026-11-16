/**
 * Recruitment report source-integrity checks, before KPI calculation.
 * These are browser-side correctness controls only. They do not grant
 * access or replace RLS, signed hosted UAT, or reviewed schema constraints.
 */
export const ALLOWED_REPORT_STAGES = Object.freeze([
  "lead_received", "contacted", "interested", "resume_collected",
  "submitted_to_client", "interview_scheduled", "interview_completed",
  "selected", "offer_released", "joined", "rejected", "dropped",
]);

export const UNASSIGNED_REPORT_KEY = "__amf_unassigned_recruiter__";

type RefId = string | null | undefined;
type Related = {
  id: string;
  candidate_uuid?: RefId;
  candidate_id?: RefId;
  client_uuid?: RefId;
  client_id?: RefId;
};
type Candidate = { id: string; stage: string; assigned_recruiter?: RefId };
type Client = { id: string };
export interface ReportSources {
  candidates: readonly Candidate[];
  submissions: readonly Related[];
  interviews: readonly Related[];
  offers: readonly Related[];
  clients: readonly Client[];
}

function linkedId(left: RefId, right: RefId): string | null {
  // Conflicting legacy and UUID aliases must not silently pick one.
  if (left != null && left !== "" && (typeof left !== "string" || !left.trim()))
    throw new Error("Report record reference is invalid");
  if (right != null && right !== "" && (typeof right !== "string" || !right.trim()))
    throw new Error("Report record reference is invalid");
  if (left && right && left !== right)
    throw new Error("Report record reference aliases conflict");
  return left || right || null;
}

export function assertReportSourceIntegrity(source: ReportSources): void {
  const candidates = new Map(source.candidates.map(c => [c.id, c]));
  const clients = new Set(source.clients.map(c => c.id));
  const stages = new Set(ALLOWED_REPORT_STAGES);
  if (candidates.size !== source.candidates.length || clients.size !== source.clients.length)
    throw new Error("Report source identity is inconsistent");
  for (const row of source.candidates) {
    if (typeof row.id !== "string" || !row.id.trim() || !stages.has(row.stage) ||
        (row.assigned_recruiter != null &&
         (typeof row.assigned_recruiter !== "string" || !row.assigned_recruiter.trim())))
      throw new Error("Report candidate stage or recruiter cannot be verified");
  }
  for (const row of source.clients) {
    if (typeof row.id !== "string" || !row.id.trim())
      throw new Error("Report client identity cannot be verified");
  }
  for (const items of [source.submissions, source.interviews, source.offers]) {
    for (const row of items) {
      if (typeof row.id !== "string" || !row.id.trim())
        throw new Error("Report related record identity is invalid");
      const candidateId = linkedId(row.candidate_uuid, row.candidate_id);
      const clientId = linkedId(row.client_uuid, row.client_id);
      if (!candidateId || !candidates.has(candidateId) ||
          !clientId || !clients.has(clientId))
        throw new Error("Report linked candidate or client unavailable");
    }
  }
}

export function validReportDay(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validReportWindow(from: string, to: string): boolean {
  return validReportDay(from) && validReportDay(to) && from <= to;
}
