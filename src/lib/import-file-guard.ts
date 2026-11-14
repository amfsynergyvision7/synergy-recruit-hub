/**
 * Offline-only import-file limits. These protect the browser from unbounded
 * spreadsheets; they do NOT authorize database imports or validate CRM links.
 */
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_PREVIEW_ROWS = 500;
export const MAX_IMPORT_PREVIEW_COLUMNS = 80;
export const MAX_IMPORT_CELL_CHARS = 16_384;

export type ImportFileMetadata = { name: string; size: number };
export type ImportGrid = { headers: readonly string[]; rows: readonly Record<string, unknown>[] };

export function validateImportFileMetadata(file: ImportFileMetadata): string | null {
  if (typeof file?.name !== "string" || !/\.(csv|xlsx|xls)$/i.test(file.name))
    return "Use a CSV or Excel (.xlsx/.xls) file.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMPORT_FILE_BYTES)
    return "The file must be nonempty and no larger than 2 MiB.";
  return null;
}

export function validateImportGrid(grid: ImportGrid): string | null {
  if (!Array.isArray(grid?.headers) || grid.headers.length === 0 ||
      grid.headers.length > MAX_IMPORT_PREVIEW_COLUMNS)
    return "The file must have 1–80 column headers.";
  if (!Array.isArray(grid?.rows) || grid.rows.length === 0 ||
      grid.rows.length > MAX_IMPORT_PREVIEW_ROWS)
    return "The file must have 1–500 data rows.";
  const names = new Set<string>();
  for (const value of grid.headers) {
    if (typeof value !== "string" || value.trim().length === 0 ||
        value.length > 200) return "Column headers must be nonempty and short.";
    const normal = value.trim().toLocaleLowerCase("en");
    if (names.has(normal)) return "Duplicate column names are not supported.";
    names.add(normal);
  }
  // Deny pathological cell payloads before rendering or further processing.
  for (const row of grid.rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return "Invalid data row.";
    if (Object.keys(row).length > MAX_IMPORT_PREVIEW_COLUMNS) return "Too many columns.";
    for (const value of Object.values(row)) {
      if (typeof value === "string" && value.length > MAX_IMPORT_CELL_CHARS)
        return "A cell exceeds the preview length limit.";
      if (value !== null && value !== undefined && typeof value === "object")
        return "Nested spreadsheet values are unsupported.";
    }
  }
  return null;
}
