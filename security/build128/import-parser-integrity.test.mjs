import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finiteImportNumber, canonicalImportDate } from "../../src/lib/offline-import-coerce.ts";
import { validateImportGrid } from "../../src/lib/import-file-guard.ts";

const source = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const importUi = source("src/routes/_app.import.tsx");

test("Build128 finite numeric import accepts zero, negatives and decimals", () => {
  for (const [value, expected] of [["0",0],["-3.75",-3.75],[".25",0.25],["+2e3",2000],[12,12]])
    assert.equal(finiteImportNumber(value), expected);
});

test("Build128 finite numeric import rejects Infinity, NaN and overflow", () => {
  for (const value of ["Infinity", "-Infinity", "NaN", "1e309", "-1e999", Infinity, NaN])
    assert.equal(finiteImportNumber(value), null, String(value));
});

test("Build128 finite numeric import refuses ambiguous numeric syntax", () => {
  for (const value of ["", "0x10", "3,500", "1_200", "12abc", "1/2", "  ", true, {}, null])
    assert.equal(finiteImportNumber(value), null, String(value));
});

test("Build128 finite numeric import rejects non-scalar input", () => {
  for (const v of [[], ["4"], {value:2}, undefined, false])
    assert.equal(finiteImportNumber(v), null);
});

test("Build128 strict dates retain valid ISO days and leap years", () => {
  for (const value of ["2024-02-29", "2026-11-14", "2000-02-29", "1999-12-31"])
    assert.equal(canonicalImportDate(value), value);
});

test("Build128 strict dates reject impossible February and month/day values", () => {
  for (const v of ["2025-02-29", "2100-02-29", "2024-02-30", "2024-04-31",
                   "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32"])
    assert.equal(canonicalImportDate(v), null, v);
});

test("Build128 strict dates reject ambiguous locale and timestamp values", () => {
  for (const v of ["11/14/2026", "14-11-2026", "2026-1-1", "2026-11-14T00:00:00Z",
                   45678, new Date("2026-11-14"), "", null, undefined])
    assert.equal(canonicalImportDate(v), null, String(v));
});

test("Build128 rejects unexpected parser-inserted fields", () => {
  const ok={headers:["candidate_code","name"], rows:[{candidate_code:"A-1",name:"Example"}]};
  assert.equal(validateImportGrid(ok),null);
  const extra={...ok,rows:[{candidate_code:"A-1",name:"Example",__parsed_extra:"secret"}]};
  assert.notEqual(validateImportGrid(extra),null);
});

test("Build128 rejects auto-renamed Excel header values not in raw header list", () => {
  const bad={headers:["full_name"],rows:[{full_name:"Example",full_name_1:"Auto-renamed"}]};
  assert.notEqual(validateImportGrid(bad),null);
});

test("Build128 accepts case-equivalent keys but not unrelated columns", () => {
  assert.equal(validateImportGrid({headers:["Full Name"],rows:[{"full name":"Example"}]}),null);
  assert.notEqual(validateImportGrid({headers:["Full Name"],rows:[{"phone":"Example"}]}),null);
});

test("Build128 CSV rejects duplicate headers hidden by PapaParse auto-renaming", () => {
  assert(importUi.includes("res.meta as { renamedHeaders?: Record<string, string> }"));
  assert(importUi.includes("Malformed or ambiguous CSV headers"));
  assert(importUi.includes("res.errors.length || Object.keys("));
});

test("Build128 Excel original full range is validated after sheetRows cap", () => {
  assert(importUi.includes('ws["!fullref"] ?? ws["!ref"]'));
  assert(importUi.includes("originalRange.e.r - originalRange.s.r > MAX_IMPORT_PREVIEW_ROWS"));
  assert(importUi.includes("originalRange.e.c - originalRange.s.c + 1 > MAX_IMPORT_PREVIEW_COLUMNS"));
});

test("Build128 Excel multi-sheet content is rejected rather than silently omitted", () => {
  assert(importUi.includes("wb.SheetNames.length !== 1"));
  assert(importUi.includes("Expected one worksheet"));
});

test("Build128 Excel raw header cells are inspected before SheetJS auto-renaming", () => {
  assert(importUi.includes("header: 1, defval:"));
  assert(importUi.includes("const headers = firstRow.map(String)"));
  assert(importUi.includes("if (!Array.isArray(firstRow))"));
});

test("Build128 import page uses strict date and numeric helpers", () => {
  assert(importUi.includes("finiteImportNumber(s)"));
  assert(importUi.includes("canonicalImportDate(s)"));
  assert(importUi.includes("canonicalImportDate(`"));
  assert(!importUi.includes("const d = new Date(s)"));
  assert(!importUi.includes("isNaN(n)"));
});

test("Build128 offline preview does not query live CRM or leak parser errors", () => {
  assert(!importUi.includes("supabase.from("));
  assert(!importUi.includes("supabase."));
  assert(importUi.includes('toast.error("Unable to parse this file safely.")'));
  assert(importUi.includes("LEGACY_BULK_IMPORT_WRITES_PAUSED"));
});

test("Build128 import has bounded CSV preview and guarded Excel dimensions", () => {
  assert(importUi.includes("preview: MAX_IMPORT_PREVIEW_ROWS + 1"));
  assert(importUi.includes("sheetRows: MAX_IMPORT_PREVIEW_ROWS + 2"));
  assert(importUi.includes("validateImportGrid({ headers, rows })"));
});

test("Build128 raw Excel date conversion is normalized as ISO day", () => {
  assert(importUi.includes("XLSX.SSF.parse_date_code(value)"));
  assert(importUi.includes('String(d.m).padStart(2,"0")'));
  assert(importUi.includes('String(d.d).padStart(2,"0")'));
  assert(importUi.includes('error: "Invalid Excel date"'));
});
