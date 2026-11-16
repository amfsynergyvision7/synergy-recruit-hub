/**
 * Build53 duplicate review export.
 * Generates a PII-minimized, NON-ACTIONABLE CSV. This is NOT authorization
 * to merge or delete candidate data. No service/database calls or writes.
 */
export interface ReviewCluster {
  clusterId: string;
  matchedOn: string[];
  members: { id: string }[];
}
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const reasons = new Set(["email","phone","name"]);

export function buildDuplicateReviewCSV(
  clusters: readonly ReviewCluster[],
  selectedIds: ReadonlySet<string>,
): string | null {
  const rows = ["review_group,retain_candidate_id,review_candidate_id,match_reasons,decision,approval_status"];
  let index=0;
  for (const cluster of clusters) {
    const selected=cluster.members.filter((m)=>selectedIds.has(m.id));
    if (!selected.length) continue;
    const keeper=cluster.members.find((m)=>!selectedIds.has(m.id));
    // Fail closed. A malformed or all-selected group must never turn into
    // a deletion plan without a separately verified retention candidate.
    if (!keeper || !uuid.test(keeper.id) || selected.some((m)=>!uuid.test(m.id))) {
      throw new Error("Review export requires a valid retained candidate and valid IDs");
    }
    const matchReasons=cluster.matchedOn.filter((r)=>reasons.has(r)).sort().join("|");
    if (!matchReasons) throw new Error("Unrecognized duplicate reason");
    index++;
    for (const member of selected) {
      rows.push([String(index),keeper.id,member.id,matchReasons,
        "manual_review_only","NOT_APPROVED"].join(","));
    }
  }
  return index===0 ? null : rows.join("\r\n")+"\r\n";
}
