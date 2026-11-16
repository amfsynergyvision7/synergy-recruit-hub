/**
 * Build 117: safe PostgREST OR patterns; RLS remains authoritative.
 * Constrained input prevents grammar injection and unexpected ILIKE wildcards.
 */
export type GlobalSearchScope = "candidates" | "clients" | "jobs";
const COLUMNS: Record<GlobalSearchScope, readonly string[]> = {
  candidates: ["full_name", "candidate_code", "email", "mobile"],
  clients: ["company_name", "contact_person"],
  jobs: ["job_title", "location"],
};
const SAFE_CHARACTERS = /^[\p{L}\p{M}\p{N} @.'+-]+$/u;

export function safeGlobalSearchTerm(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 120) return null;
  const normalized = input.normalize("NFC").trim();
  if (normalized.length < 2 || normalized.length > 80 ||
      !SAFE_CHARACTERS.test(normalized)) return null;
  return normalized;
}

export function buildSafeGlobalSearchOr(term: string, scope: GlobalSearchScope): string {
  const input = safeGlobalSearchTerm(term);
  if (!input || !Object.prototype.hasOwnProperty.call(COLUMNS, scope))
    throw new Error("Search input is not safe for a CRM query");
  // Quote reserved values per the documented PostgREST URL grammar.
  const pattern = `"%${input}%"`;
  return COLUMNS[scope].map((column) => `${column}.ilike.${pattern}`).join(",");
}
