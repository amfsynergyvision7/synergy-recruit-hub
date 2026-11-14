/**
 * Build137: fail-closed decoding of small CRM search suggestions.
 *
 * Suggestions are intentionally limited to six per module, NOT a full
 * directory or proof that no additional matches exist. Server RLS must
 * authorize access independently; this pure decoder cannot grant access.
 */
export type SearchPreviewScope = "candidates" | "clients" | "jobs";
export interface SearchPreviewRow {
  id: string;
  label: string;
  sublabel: string;
}
export const MAX_SEARCH_PREVIEW_ROWS = 6 as const;

const NAME_FIELD: Record<SearchPreviewScope, string> = {
  candidates: "full_name",
  clients: "company_name",
  jobs: "job_title",
};
const SECONDARY_FIELDS: Record<SearchPreviewScope, readonly string[]> = {
  candidates: ["candidate_code", "position_applied"],
  clients: ["contact_person"],
  jobs: ["location"],
};
const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export function decodeSearchPreview(
  scope: SearchPreviewScope,
  rows: unknown,
): SearchPreviewRow[] {
  if (!Object.prototype.hasOwnProperty.call(NAME_FIELD, scope) ||
      !Array.isArray(rows) || rows.length > MAX_SEARCH_PREVIEW_ROWS)
    throw new Error("Unverified CRM search result");
  const seen = new Set<string>();
  return rows.map(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Unverified CRM search result");
    const row = entry as Record<string, unknown>;
    const label = row[NAME_FIELD[scope]];
    if (typeof row.id !== "string" || !row.id.trim() ||
        seen.has(row.id) || typeof label !== "string" || !label.trim() ||
        SECONDARY_FIELDS[scope].some(field => !isStringOrNull(row[field])))
      throw new Error("Unverified CRM search result");
    seen.add(row.id);
    return {
      id: row.id,
      label,
      sublabel: SECONDARY_FIELDS[scope].map(field => row[field])
        .filter((value): value is string => typeof value === "string" && !!value)
        .join(" · "),
    };
  });
}

export function decodeSearchBuckets(source: {
  candidates: unknown;
  clients: unknown;
  jobs: unknown;
}): Record<SearchPreviewScope, SearchPreviewRow[]> {
  // All buckets must validate before any data is visible. One malicious,
  // malformed or incomplete bucket cannot silently become an empty list.
  return {
    candidates: decodeSearchPreview("candidates", source.candidates),
    clients: decodeSearchPreview("clients", source.clients),
    jobs: decodeSearchPreview("jobs", source.jobs),
  };
}
