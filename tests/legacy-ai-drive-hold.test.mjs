import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  CRM_LEGACY_CANDIDATE_AI_HOLD,
  CRM_LEGACY_DRIVE_BULK_IMPORT_HOLD,
  assertLegacyCandidateAiProcessingReleased,
  assertLegacyDriveBulkImportReleased,
} from "../src/lib/legacy-ai-drive-release-hold.server.ts";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Immutable candidate AI / Drive import holds remain active and never read environment",()=>{
  assert.equal(CRM_LEGACY_CANDIDATE_AI_HOLD,true);
  assert.equal(CRM_LEGACY_DRIVE_BULK_IMPORT_HOLD,true);
  assert.throws(assertLegacyCandidateAiProcessingReleased,/paused pending privacy/);
  assert.throws(assertLegacyDriveBulkImportReleased,/paused pending privacy/);
  const helper=read("src/lib/legacy-ai-drive-release-hold.server.ts");
  for(const x of ["process.env","import.meta.env","localStorage","sessionStorage"]) assert.ok(!helper.includes(x));
});
test("Six authenticated server functions enforce their exact hold before processing",()=>{
  const code=read("src/lib/ai.functions.ts");
  const names=["matchCandidates","matchCandidateWithResume","generateCandidateResumeSummary","generateCandidateAtsScoreFn","generateClientResumePdf","checkDriveForNewResumes"];
  for(let i=0;i<names.length;i++){
    const start=code.indexOf("export const "+names[i]+" = createServerFn");
    const end=i+1<names.length?code.indexOf("export const "+names[i+1]+" = createServerFn",start):code.length;
    assert.ok(start>=0&&end>start,names[i]);
    const body=code.slice(start,end);
    const hold=names[i]==="checkDriveForNewResumes"?"assertLegacyDriveBulkImportReleased();":"assertLegacyCandidateAiProcessingReleased();";
    assert.ok(body.includes(".middleware([requireSupabaseAuth])"));
    assert.ok(body.includes(hold),names[i]);
    assert.ok(body.indexOf(hold)>body.indexOf(".handler(async"),names[i]);
  }
});
test("AI provider blocks before API key or any outbound fetch",()=>{
  const code=read("src/lib/ai.server.ts");
  const start=code.indexOf("async function callGeminiJSON");
  const end=code.indexOf("async function ",start+8);
  const text=code.slice(start,end<0?start+1400:end);
  assert.ok(text.includes("assertLegacyCandidateAiProcessingReleased();"));
  assert.ok(text.indexOf("assertLegacyCandidateAiProcessingReleased();")<text.indexOf("process.env.GEMINI_API_KEY"));
  assert.ok(text.indexOf("assertLegacyCandidateAiProcessingReleased();")<text.indexOf("await fetch("));
});
test("Drive importer blocks before API credentials, network reads or CRM writes",()=>{
  const code=read("src/lib/drive-import.server.ts");
  const start=code.indexOf("export async function runResumeDriveImport");
  const end=code.indexOf("  const apiKey = process.env.DRIVE_API_KEY",start);
  assert.ok(start>=0&&end>start);
  assert.ok(code.slice(start,end).includes("assertLegacyDriveBulkImportReleased();"));
});
