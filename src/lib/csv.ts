// Tiny, dependency-free CSV export used by both CrudModule's per-module
// "Export CSV" button and the Reports page's per-report exports. Kept as one
// shared helper instead of copy-pasting the same escaping/download logic in
// both places (this is exactly the kind of thing that silently drifts if
// duplicated — e.g. one copy escaping quotes and the other not).
//
// No library (no papaparse, no xlsx) on purpose: a CSV is just delimited
// text, this is a prototype-phase app on Supabase's free tier, and pulling in
// a dependency for something `Array.prototype.map` + a `Blob` already does
// isn't worth the install.

/** Escape one CSV field: wrap in quotes (doubling any interior quotes)
 * whenever the value contains a comma, quote, or newline — the three
 * characters that would otherwise corrupt the column/row structure. */
 function escapeCsvCell(value: string | number | null | undefined): string {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  
  /** Build a CSV string (CRLF line endings, per RFC 4180) from a header row
   * and an array of data rows. Every row must have the same length as
   * `headers` — callers build both from the same field list, so this always
   * holds in practice. */
  export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
    return lines.join("\r\n");
  }
  
  /** Trigger a browser download of `csv` as `filename`. A UTF-8 BOM is
   * prepended so Excel (which otherwise guesses the wrong encoding for
   * anything outside ASCII — e.g. the ₹ symbol or a name with a diacritic)
   * opens the file correctly instead of showing mojibake. */
  export function downloadCsv(filename: string, csv: string) {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /** Today's date as YYYY-MM-DD, for stamping export filenames. Local time,
   * not UTC — matches the recruiter's own wall-clock day, same reasoning as
   * scheduling.ts's slot handling. */
  export function todayStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }