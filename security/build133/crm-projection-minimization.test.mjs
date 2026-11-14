import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crmRowProjection, crmRelationProjection } from "../../src/lib/crm-read-projection.ts";

const ui=readFileSync(new URL("../../src/components/CrudModule.tsx",import.meta.url),"utf8");
const input=(module,table,fieldNames,rest={})=>({module,table,fieldNames,...rest});
const columns=value=>value.split(", ");

test("Build133 client table uses precisely declared fields plus stable ID/date",()=>{
 const p=columns(crmRowProjection(input("clients","clients",["company_name","email","phone"])));
 assert.deepEqual(p,["company_name","created_at","email","id","phone"]);
 assert(!p.includes("*"));
});
test("Build133 candidate preview includes only known supporting metadata, not all columns",()=>{
 const p=columns(crmRowProjection(input("candidates","candidates",
 ["full_name","mobile","email","resume_url","ats_score","client_resume","stage"])));
 for(const x of ["id","created_at","updated_at","resume_summary","ats_issues",
                 "full_name","resume_url","ats_score","stage"])assert(p.includes(x),x);
 for(const x of ["created_by","status","client_resume","created_source","ats_checked_at"])
  assert(!p.includes(x),x);
});
test("Build133 interview scheduling display keeps required non-form fields",()=>{
 const p=columns(crmRowProjection(input("interviews","interviews",
 ["candidate_uuid","interview_date","status","scheduling_link"])));
 for(const x of ["scheduling_token","proposed_slots","status","interview_date"])
  assert(p.includes(x),x);
 assert(!p.includes("scheduling_link"));
});
test("Build133 job opening public careers link is virtual, not queried from DB",()=>{
 const p=columns(crmRowProjection(input("jobs","job_openings",
 ["job_title","is_confidential","status","careers_link"])));
 assert(!p.includes("careers_link"));
 for(const x of ["id","created_at","job_title","is_confidential","status"])assert(p.includes(x));
});
test("Build133 submissions and offers keep their declared FK and finance status only",()=>{
 const a=columns(crmRowProjection(input("submissions","submissions",["candidate_uuid","role_title"])));
 assert.deepEqual(a,["candidate_uuid","created_at","id","role_title"]);
 const b=columns(crmRowProjection(input("offers","offers",["candidate_uuid","joining_status"])));
 assert.deepEqual(b,["candidate_uuid","created_at","id","joining_status"]);
 assert(!b.includes("salary"));
});
test("Build133 billing remains a declared-fields projection despite release hold",()=>{
 const p=columns(crmRowProjection(input("billing","billing",["invoice_number","payment_status"])));
 assert.deepEqual(p,["created_at","id","invoice_number","payment_status"]);
});
test("Build133 search, email and sort fields are explicit and deduplicated",()=>{
 const p=columns(crmRowProjection(input("clients","clients",["email","company_name","email"],{
 searchFields:["company_name","contact_person"],emailField:"email",orderBy:"created_at",
 })));
 assert.deepEqual(p,["company_name","contact_person","created_at","email","id"]);
});
test("Build133 module/table mismatch is rejected rather than guessed",()=>{
 for(const [module,table] of [["clients","billing"],["offers","candidates"],
  ["jobs","jobs"],["unknown","clients"],["clients",""],["","clients"]])
  assert.throws(()=>crmRowProjection(input(module,table,["id"])),/not reviewed/);
});
test("Build133 dynamic identifiers and select injection are rejected",()=>{
 for(const column of ["","*","full_name, status","name)","id;drop","id(id)","id\nstatus",
 "Name","__proto__","data->name","data.foo"," id"])
  assert.throws(()=>crmRowProjection(input("clients","clients",[column])),
    /Unsupported CRM projection column/,column);
});
test("Build133 relation projection requires explicit columns and unique ID",()=>{
 assert.equal(crmRelationProjection("id, full_name, candidate_code"),"id, full_name, candidate_code");
 assert.equal(crmRelationProjection(" id , company_name "), "id, company_name");
 for(const bad of [null,undefined,"", "  ","*", "id,*","company_name",
  "id, id","id,full_name,id", "id,created_by; DROP TABLE", "id, data->email",
  "id, name as email","id, ,full_name"])
   assert.throws(()=>crmRelationProjection(bad),/CRM relation projection/);
});
test("Build133 generic CRM has no select-all wildcard on records or relations",()=>{
 assert(ui.includes('select(recordProjection, { count: "exact" })'));
 assert(ui.includes('select(crmRelationProjection(field.relation!.select), { count: "exact" })'));
 assert(!ui.includes('select("*", { count: "exact" })'));
 assert(!ui.includes('field.relation!.select ?? "*"'));
 assert(ui.includes("crmRowProjection({"));
});
test("Build133 projection still honors reviewed account/role shell and exact count paging",()=>{
 for(const invariant of [
 "canMountApprovedCrm(user?.id, profile, role)",
 "readCompleteCrmRows(async (from, to, signal) =>",
 ".order(\"id\", { ascending: true }).range(from, to).abortSignal(signal)",
 "checkedCrmPageIds(result.data)",
 "verifiedForMutation = rowsVerified && relationsLoaded && !loading",
 ]) assert(ui.includes(invariant),invariant);
});
test("Build133 broad relation fetch and raw server errors remain forbidden",()=>{
 assert(!ui.includes('select(field.relation!.select ?? "*"'));
 assert(!ui.includes('toast.error(error.message)'));
 assert(!ui.includes("service_role"));
});
test("Build133 candidate and financial mutation holds remain unconditional",()=>{
 for(const k of ["LEGACY_CANDIDATE_WRITES_PAUSED","LEGACY_BILLING_MUTATIONS_PAUSED",
  "LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED",
  "!candidateMutationPaused && !billingMutationPaused"])
  assert(ui.includes(k),k);
});
test("Build133 projection helpers perform no DB writes or privileged reads",()=>{
 const text=readFileSync(new URL("../../src/lib/crm-read-projection.ts",import.meta.url),"utf8");
 for(const word of ["supabase.from","service_role","process.env","import.meta.env",
 ".update(",".delete(",".insert(","fetch(","localStorage"])
  assert(!text.includes(word),word);
});
