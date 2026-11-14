import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_IMPORT_FILE_BYTES, MAX_IMPORT_PREVIEW_COLUMNS,
  MAX_IMPORT_PREVIEW_ROWS, MAX_IMPORT_CELL_CHARS,
  validateImportFileMetadata, validateImportGrid,
} from "../../src/lib/import-file-guard.ts";

const goodMeta = { name: "synthetic-test.csv", size: 120 };
const goodGrid = { headers: ["name", "email"], rows: [{ name: "Example", email: "example.invalid" }] };
const src = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Build127 accepts a bounded CSV/XLS/XLSX metadata shape", () => {
  for (const name of ["a.csv", "A.XLSX", "a.xls"])
    assert.equal(validateImportFileMetadata({ ...goodMeta, name }), null);
});

test("Build127 rejects extension spoofing and unsupported formats", () => {
  for (const name of ["a.csv.exe", ".csv", "a.json", "a.xlsm", "", "a.csv/"])
    assert.notEqual(validateImportFileMetadata({ ...goodMeta, name }), null, name);
});

test("Build127 enforces nonempty and maximum two-MiB file size", () => {
  assert.equal(validateImportFileMetadata({ ...goodMeta, size: MAX_IMPORT_FILE_BYTES }), null);
  for (const size of [0, -1, MAX_IMPORT_FILE_BYTES + 1, NaN, Infinity, 1.5])
    assert.notEqual(validateImportFileMetadata({ ...goodMeta, size }), null, String(size));
});

test("Build127 accepts valid synthetic grid", () => {
  assert.equal(validateImportGrid(goodGrid), null);
});

test("Build127 denies zero and over-cap rows", () => {
  assert.notEqual(validateImportGrid({ headers: ["a"], rows: [] }), null);
  assert.equal(validateImportGrid({ headers: ["a"], rows: Array.from({length: MAX_IMPORT_PREVIEW_ROWS}, () => ({a:"ok"})) }), null);
  assert.notEqual(validateImportGrid({ headers: ["a"], rows: Array.from({length: MAX_IMPORT_PREVIEW_ROWS+1}, () => ({a:"ok"})) }), null);
});

test("Build127 rejects missing, excessive or duplicate headers", () => {
  assert.notEqual(validateImportGrid({ headers: [], rows: [{}] }), null);
  assert.equal(validateImportGrid({ headers: Array.from({length: MAX_IMPORT_PREVIEW_COLUMNS}, (_,i)=>"h"+i), rows:[{}] }), null);
  assert.notEqual(validateImportGrid({ headers: Array.from({length: MAX_IMPORT_PREVIEW_COLUMNS+1}, (_,i)=>"h"+i), rows:[{}] }), null);
  assert.notEqual(validateImportGrid({ headers: ["Email", " email "], rows:[{}] }), null);
  assert.notEqual(validateImportGrid({ headers: ["Email", ""], rows:[{}] }), null);
});

test("Build127 rejects excessively long headers and cells", () => {
  assert.notEqual(validateImportGrid({ headers: ["x".repeat(201)], rows:[{}] }), null);
  assert.equal(validateImportGrid({ headers:["a"], rows:[{a:"x".repeat(MAX_IMPORT_CELL_CHARS)}] }), null);
  assert.notEqual(validateImportGrid({ headers:["a"], rows:[{a:"x".repeat(MAX_IMPORT_CELL_CHARS+1)}] }), null);
});

test("Build127 rejects malformed nested data cells or rows", () => {
  assert.notEqual(validateImportGrid({ headers:["a"], rows:[null] }), null);
  assert.notEqual(validateImportGrid({ headers:["a"], rows:[{a: {nested: 1}}] }), null);
  assert.notEqual(validateImportGrid({ headers:["a"], rows:[{a: ["nested"]}] }), null);
});

test("Build127 rejects excessive keys even when headers are short", () => {
  const row = Object.fromEntries(Array.from({length:MAX_IMPORT_PREVIEW_COLUMNS+1}, (_,i)=>["f"+i,"v"]));
  assert.notEqual(validateImportGrid({ headers:["f1"], rows:[row] }), null);
});

test("Build127 importer checks files before parsing and the grid before rendering", () => {
  const page=src("src/routes/_app.import.tsx");
  assert(page.includes("const fileError = validateImportFileMetadata(f)"));
  assert(page.includes("const gridError = validateImportGrid({ headers, rows })"));
  assert(page.indexOf("validateImportFileMetadata(f)") < page.indexOf("await parseFile(f)"));
  assert(page.indexOf("validateImportGrid({ headers, rows })") < page.indexOf("setRawRows(rows)"));
});

test("Build127 rejects malformed PapaParse CSV instead of silently showing partial rows", () => {
  const page=src("src/routes/_app.import.tsx");
  assert(page.includes('if (res.errors.length) reject(new Error("Malformed CSV input"))'));
  assert(page.includes('toast.error("Unable to parse this file safely.")'));
  assert(!page.includes('"Parse failed: " + e.message'));
});

test("Build127 replaces old file only after validating latest parse", () => {
  const page=src("src/routes/_app.import.tsx");
  assert(page.includes("const epoch = ++previewEpoch.current"));
  assert(page.includes("if (epoch !== previewEpoch.current) return"));
  assert(page.includes("previewEpoch.current++"));
  assert(page.includes('setFile(null); setRawRows([]); setMappedRows([]); setFileHeaders([])'));
  assert(page.includes("setFile(f);"));
});

test("Build127 import still performs no unauthorized CRM reads or writes", () => {
  const page=src("src/routes/_app.import.tsx");
  assert(!page.includes("supabase.from("));
  assert(!page.includes("supabase."));
  assert(page.includes("if (!canReadPrivateUserDirectory(user?.id, profile, role))"));
  assert(page.includes("if (LEGACY_BULK_IMPORT_WRITES_PAUSED)"));
  assert(page.includes("disabled={running || LEGACY_BULK_IMPORT_WRITES_PAUSED}"));
});

test("Build127 original guarded Build60 source contract matches safe recruiter scoping", () => {
  const testFile=src("security/build60/confirmed-bulk-recovery.test.mjs");
  // The original guarded contract now validates recruiter-role and profile
  // count controls instead of assuming a particular quote style.
  assert(testFile.includes('roleResult'));
  assert(testFile.includes('profileResult'));
  const route=src("src/routes/_app.candidates.tsx");
  assert(route.includes('.in("id", ids).eq("status", "approved").eq("is_active", true)'));
});
