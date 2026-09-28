// Server-only: scans the ENTIRE existing candidate list for likely
// duplicates — the same person entered more than once over time, from
// different sources (a manual entry, then a Drive import, then a second
// manual entry with a slightly different email, etc).
//
// The Google Drive bulk-import feature (drive-import.server.ts) already
// prevents *new* duplicates going forward, by checking each incoming resume
// against the existing table before creating a row. This is the other half:
// a one-time (and safely re-runnable, since it never writes anything by
// itself) sweep across everything already in the table, grouping candidates
// that share a normalized email, phone, or full name into review clusters.
// Nothing is ever deleted here — this only computes the clusters; the actual
// delete happens client-side, the same way every other delete in this app
// works, so it's governed by the exact same admin-only RLS policy.
import { normalizeEmail, normalizePhone, normalizeName } from "./dedupe";

export interface DuplicateCandidate {
  id: string;
  full_name: string;
  candidate_code: string | null;
  email: string | null;
  mobile: string | null;
  position_applied: string | null;
  stage: string;
  status: string;
  source: string | null;
  location: string | null;
  current_company: string | null;
  experience_years: number | null;
  resume_url: string | null;
  created_at: string;
}

export type DuplicateMatchReason = "email" | "phone" | "name";

export interface DuplicateCluster {
  clusterId: string;
  matchedOn: DuplicateMatchReason[];
  // Oldest first — the earliest-created record in a cluster is usually the
  // "original" and a reasonable default for which one to keep, but nothing
  // here enforces that; the reviewer picks.
  members: DuplicateCandidate[];
}

export interface DuplicateScanSummary {
  totalCandidates: number;
  candidatesInvolved: number;
  clusters: DuplicateCluster[];
}

// Simple union-find (disjoint-set) with path compression — standard way to
// group records into connected clusters from a set of pairwise matches
// (candidate #3 can end up in the same cluster as #1 via #2, even if #1 and
// #3 share nothing directly).
class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export async function findDuplicateClusters(supabase: any): Promise<DuplicateScanSummary> {
  const { data, error } = await supabase
    .from("candidates")
    .select(
      "id, full_name, candidate_code, email, mobile, position_applied, stage, status, source, location, current_company, experience_years, resume_url, created_at",
    )
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;

  const candidates: DuplicateCandidate[] = data ?? [];
  const uf = new UnionFind(candidates.length);

  // Every pairwise match this scan is willing to make, tagged with *why*,
  // so a cluster can later be labeled with all the reasons that actually
  // connected its members (not just one, and not a guess).
  const edges: { a: number; b: number; reason: DuplicateMatchReason }[] = [];

  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  const byName = new Map<string, number>();

  candidates.forEach((c, i) => {
    const email = normalizeEmail(c.email);
    if (email) {
      const prev = byEmail.get(email);
      if (prev !== undefined) {
        uf.union(prev, i);
        edges.push({ a: prev, b: i, reason: "email" });
      } else byEmail.set(email, i);
    }

    const phone = normalizePhone(c.mobile);
    if (phone) {
      const prev = byPhone.get(phone);
      if (prev !== undefined) {
        uf.union(prev, i);
        edges.push({ a: prev, b: i, reason: "phone" });
      } else byPhone.set(phone, i);
    }

    // Never index a candidate whose name is missing/"NA" — otherwise every
    // NA-named candidate (common on Drive-import rows Gemini couldn't pull
    // a name from) would falsely cluster with every other one.
    const name = normalizeName(c.full_name);
    if (name && name !== "na") {
      const prev = byName.get(name);
      if (prev !== undefined) {
        uf.union(prev, i);
        edges.push({ a: prev, b: i, reason: "name" });
      } else byName.set(name, i);
    }
  });

  const groups = new Map<number, number[]>();
  candidates.forEach((_, i) => {
    const root = uf.find(i);
    const arr = groups.get(root);
    if (arr) arr.push(i);
    else groups.set(root, [i]);
  });

  const clusters: DuplicateCluster[] = [];
  let candidatesInvolved = 0;

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;

    const indexSet = new Set(indices);
    const matchedOn = new Set<DuplicateMatchReason>();
    for (const edge of edges) {
      if (indexSet.has(edge.a) && indexSet.has(edge.b)) matchedOn.add(edge.reason);
    }

    const members = indices
      .map((i) => candidates[i])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    clusters.push({
      clusterId: members.map((m) => m.id).sort().join("-"),
      matchedOn: Array.from(matchedOn),
      members,
    });
    candidatesInvolved += members.length;
  }

  // Biggest, most-actionable clusters first.
  clusters.sort((a, b) => b.members.length - a.members.length);

  return { totalCandidates: candidates.length, candidatesInvolved, clusters };
}