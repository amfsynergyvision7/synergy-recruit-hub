import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings=readFileSync(new URL("../../src/routes/_app.settings.tsx",import.meta.url),"utf8");
const drive=readFileSync(new URL("../../src/lib/drive-import.server.ts",import.meta.url),"utf8");

test("Build116 Settings never instructs staff to make applicant resume folders publicly accessible",()=>{
  assert(!settings.includes('set it to "Anyone with the link — Viewer"'));
  assert(settings.includes('Do not make them public or enable "Anyone with the link" access'));
  assert(settings.includes("permission-scoped Drive access"));
});

test("Build116 held Drive import cannot save a new public URL through the Settings UI",()=>{
  assert(settings.includes('import { LEGACY_BULK_IMPORT_WRITES_PAUSED }'));
  const save=settings.slice(settings.indexOf("const saveDriveFolder = async () => {"),
    settings.indexOf("const save = async () => {"));
  assert(save.indexOf("if (LEGACY_BULK_IMPORT_WRITES_PAUSED)")>=0);
  assert(save.indexOf("if (LEGACY_BULK_IMPORT_WRITES_PAUSED)") <
    save.indexOf('updateAdminSetting("resume_import_folder_url"'));
  assert(settings.includes("disabled={LEGACY_BULK_IMPORT_WRITES_PAUSED}"));
  assert(settings.includes("disabled={LEGACY_BULK_IMPORT_WRITES_PAUSED || savingFolder}"));
});

test("Build116 server import refuses before accessing API credentials and the Google Drive network",()=>{
  const run=drive.slice(drive.indexOf("export async function runResumeDriveImport("));
  const hold=run.indexOf("assertDriveBulkImportReviewed();");
  assert(hold>0);
  assert(hold<run.indexOf("process.env.DRIVE_API_KEY"));
  assert(hold<run.indexOf("listFolderFiles("));
});
