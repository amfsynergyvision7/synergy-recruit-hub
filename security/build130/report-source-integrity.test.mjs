import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_REPORT_STAGES, UNASSIGNED_REPORT_KEY,
  assertReportSourceIntegrity, validReportDay, validReportWindow,
} from "../../src/lib/report-source-integrity.ts";
import { canReadPipelineReports } from "../../src/lib/crm-report-access.ts";

const page=readFileSync(new URL("../../src/routes/_app.reports.tsx",import.meta.url),"utf8");
const basic=()=>({
  candidates:[{id:"candidate-1",stage:"lead_received",assigned_recruiter:"recruiter-1"}],
  clients:[{id:"client-1"}],
  submissions:[{id:"sub-1",candidate_uuid:"candidate-1",candidate_id:"candidate-1",client_uuid:"client-1",client_id:"client-1"}],
  interviews:[{id:"interview-1",candidate_uuid:"candidate-1",client_uuid:"client-1"}],
  offers:[{id:"offer-1",candidate_id:"candidate-1",client_id:"client-1"}],
});

test("Build130 all current candidate pipeline stages pass strict source integrity",()=>{
  for(const stage of ALLOWED_REPORT_STAGES){
    const x=basic();x.candidates[0].stage=stage;
    assert.doesNotThrow(()=>assertReportSourceIntegrity(x),stage);
  }
  assert.equal(ALLOWED_REPORT_STAGES.length,12);
});

test("Build130 unknown stage cannot silently disappear from pipeline share",()=>{
  for(const stage of ["created","pending","",null,undefined]){
    const x=basic();x.candidates[0].stage=stage;
    assert.throws(()=>assertReportSourceIntegrity(x),/stage or recruiter/);
  }
});

test("Build130 missing RLS-visible candidate for a submission is an error",()=>{
  const x=basic();x.submissions[0].candidate_uuid="hidden-candidate";
  x.submissions[0].candidate_id="hidden-candidate";
  assert.throws(()=>assertReportSourceIntegrity(x),/linked candidate or client/);
});

test("Build130 missing RLS-visible client for an interview is an error",()=>{
  const x=basic();x.interviews[0].client_uuid="hidden-client";
  assert.throws(()=>assertReportSourceIntegrity(x),/linked candidate or client/);
});

test("Build130 conflicting legacy and UUID aliases are rejected",()=>{
  const x=basic();x.submissions[0].candidate_id="other";
  assert.throws(()=>assertReportSourceIntegrity(x),/aliases conflict/);
  const y=basic();y.submissions[0].client_id="other";
  assert.throws(()=>assertReportSourceIntegrity(y),/aliases conflict/);
});

test("Build130 missing candidate or client links never turn into unattributed KPIs",()=>{
  const x=basic();x.offers[0].candidate_id=null;
  assert.throws(()=>assertReportSourceIntegrity(x),/linked candidate or client/);
  const y=basic();y.offers[0].client_id=null;
  assert.throws(()=>assertReportSourceIntegrity(y),/linked candidate or client/);
});

test("Build130 duplicate candidate and client source IDs fail closed",()=>{
  const x=basic();x.candidates.push({...x.candidates[0]});
  assert.throws(()=>assertReportSourceIntegrity(x),/identity/);
  const y=basic();y.clients.push({...y.clients[0]});
  assert.throws(()=>assertReportSourceIntegrity(y),/identity/);
});

test("Build130 invalid candidate IDs and blank recruiter IDs are refused",()=>{
  const x=basic();x.candidates[0].id=" ";
  assert.throws(()=>assertReportSourceIntegrity(x),/stage or recruiter/);
  const y=basic();y.candidates[0].assigned_recruiter=" ";
  assert.throws(()=>assertReportSourceIntegrity(y),/stage or recruiter/);
});

test("Build130 unassigned recruiter is a valid category, not a lost KPI",()=>{
  const x=basic();x.candidates[0].assigned_recruiter=null;
  assert.doesNotThrow(()=>assertReportSourceIntegrity(x));
  assert.equal(UNASSIGNED_REPORT_KEY,"__amf_unassigned_recruiter__");
  assert(page.includes('ensure(c.assigned_recruiter || UNASSIGNED_REPORT_KEY).added++'));
  assert(page.includes('|| UNASSIGNED_REPORT_KEY'));
  assert(page.includes('id === UNASSIGNED_REPORT_KEY ? "Unassigned"'));
});

test("Build130 baseline source-less empty reports are valid, not manufactured data",()=>{
  assert.doesNotThrow(()=>assertReportSourceIntegrity({
    candidates:[],clients:[],submissions:[],interviews:[],offers:[]
  }));
});

test("Build130 ISO report calendar days are validated including leap years",()=>{
  for(const v of ["2024-02-29","2000-02-29","2026-11-14"])
    assert.equal(validReportDay(v),true,v);
  for(const v of ["2025-02-29","2100-02-29","2026-02-30","2026-00-01","2026-13-01",
                    "14/11/2026","2026-1-1","", "2026-11-14T00:00:00Z"])
    assert.equal(validReportDay(v),false,v);
});

test("Build130 a reversed or malformed date interval blocks report exports",()=>{
  assert.equal(validReportWindow("2026-11-01","2026-11-14"),true);
  assert.equal(validReportWindow("2026-11-14","2026-11-14"),true);
  assert.equal(validReportWindow("2026-11-15","2026-11-14"),false);
  assert.equal(validReportWindow("","2026-11-14"),false);
});

test("Build130 report validates all five complete source arrays before publishing KPIs",()=>{
  assert.equal((page.match(/readBoundedReportRows\(/g)||[]).length,5);
  assert(page.includes("assertReportSourceIntegrity({ candidates, submissions, interviews, offers, clients });"));
  const validation=page.indexOf("assertReportSourceIntegrity({");
  const published=page.indexOf("return { candidates, submissions, interviews, offers, clients };");
  assert(validation>0&&validation<published);
  assert(page.includes('throw new Error("Unable to retrieve authorized reporting data")'));
});

test("Build130 malformed report date range still allows editing controls but no metrics",()=>{
  assert(page.includes("const validWindow = validReportWindow(from, to)"));
  assert(page.includes("{!validWindow ? ("));
  assert(page.includes("No metrics or exports are shown."));
  assert(page.includes('type="date" value={from}'));
  assert(page.includes('type="date" value={to}'));
});

test("Build130 date presets use the local date rather than UTC rollover",()=>{
  assert(page.includes("function localDateIso(date: Date)"));
  assert(page.includes("date.getFullYear()"));
  assert(page.includes("date.getMonth() + 1"));
  assert(page.includes("date.getDate()"));
  assert(page.includes("setTo(localDateIso(new Date()))"));
});

test("Build130 report still denies viewers, finance, suspended and unapproved accounts",()=>{
  const approved={id:"auth-a",status:"approved",is_active:true};
  for(const role of ["admin","operations","recruiter"])
    assert.equal(canReadPipelineReports("auth-a",approved,role),true);
  for(const role of ["viewer","finance",null,"guest"])
    assert.equal(canReadPipelineReports("auth-a",approved,role),false);
  assert.equal(canReadPipelineReports("auth-a",{...approved,status:"suspended"},"admin"),false);
  assert(page.includes("if (!allowed)"));
  assert(page.includes("enabled: allowed"));
});

test("Build130 source integrity is transport-only, with no privilege or mutation surface",()=>{
  const helper=readFileSync(new URL("../../src/lib/report-source-integrity.ts",import.meta.url),"utf8");
  for(const x of ["service_role","process.env","supabase.from","update(","insert(","delete(","fetch("])
    assert(!helper.includes(x),x);
  assert(!page.includes('supabase.from("billing")'));
  assert(!page.includes("ctc, salary"));
});
