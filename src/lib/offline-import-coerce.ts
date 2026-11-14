/**
 * Strict, local spreadsheet cell normalization for a paused CRM import preview.
 * No CRM reads or writes. Parsing is deliberately conservative to prevent
 * ambiguous regional dates and non-finite amounts from appearing valid.
 */
export function finiteImportNumber(input: unknown): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function canonicalImportDate(input: unknown): string | null {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(input + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === input ? input : null;
}
