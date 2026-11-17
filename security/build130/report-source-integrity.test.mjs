import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_REPORT_STAGES, UNASSIGNED_REPORT_KEY, assertCandidateSourceIntegrity,
  assertRecruiterReportSourceIntegrity, assertReportSourceIntegrity, validReportDay, validReportWindow,
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

test("Recruiter report integrity does not require denied client or offer rows",()=>{
  const x=basic();
  assert.doesNotThrow(()=>assertRecruiterReportSourceIntegrity({
    candidates:x.candidates,submissions:x.submissions,interviews:x.interviews,
  }));
  x.submissions[0].candidate_uuid="hidden-candidate";
  x.submissions[0].candidate_id="hidden-candidate";
  assert.throws(()=>assertRecruiterReportSourceIntegrity({
    candidates:x.candidates,submissions:x.submissions,interviews:x.interviews,
  }),/linked candidate unavailable/);
});

test("Recruiter report route never queries denied client and offer sources",()=>{
  assert(page.includes('const canReadOutcomes = role !== "recruiter"'));
  assert(page.includes('canReadOutcomes ? readBoundedReportRows((from, to, abort) =>\n            supabase.from("offers")'));
  assert(page.includes('canReadOutcomes ? readBoundedReportRows((from, to, abort) =>\n            supabase.from("clients")'));
  assert(page.includes("assertRecruiterReportSourceIntegrity({ candidates, submissions, interviews })"));
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

test("Pipeline reports use the fixed Asia/Kolkata business date",()=>{
  assert(page.includes('timeZone: "Asia/Kolkata"'));
  assert(page.includes("function reportingDateIso(date: Date)"));
  assert(page.includes("reportingDateFormatter.formatToParts(date)"));
  assert(page.includes("setTo(reportingDateIso(new Date()))"));
  assert(page.includes("const reportingDay = reportingDateIso(date)"));
  assert(page.includes("return reportingDay >= from && reportingDay <= to"));
  assert(page.includes("setFrom(isoDateNDaysAgo(days - 1))"));
});

test("Pipeline event windows use business-event dates with legacy fallback",()=>{
  assert(page.includes("submission_date, created_at"));
  assert(page.includes("interview_date, created_at"));
  assert(page.includes("offer_date, created_at"));
  assert(page.includes("s.submission_date ?? s.created_at"));
  assert(page.includes("i.interview_date ?? i.created_at"));
  assert(page.includes("o.offer_date ?? o.created_at"));
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

test("Build130 dashboard profile labels and ranking respect least privilege",()=>{
 const src=readFileSync(new URL("../../src/routes/_app.dashboard.tsx",import.meta.url),"utf8");
 assert(src.includes('if (role === "admin" && recruiterIds.length > 0)'));
 assert(src.includes(".select('id, full_name', { count: 'exact' })"));
 assert(src.includes('profilesCount !== profiles.length'));
 assert(src.includes('name: recruiterFallbackLabel(recruiterId)'));
 assert(src.includes('b.count - a.count || b.joined - a.joined || a.name.localeCompare(b.name)'));
 assert(!src.includes('name: recruiterId }'));
});

test("Dashboard candidate snapshot rejects malformed or incomplete KPI source data",()=>{
  const valid=[{id:"candidate-a",stage:"lead_received",assigned_recruiter:null},
               {id:"candidate-b",stage:"joined",assigned_recruiter:"staff-a"}];
  assert.doesNotThrow(()=>assertCandidateSourceIntegrity(valid));
  assert.throws(()=>assertCandidateSourceIntegrity([...valid, {...valid[0]}]),/identity/);
  for(const stage of ["unrecognized", "", null, undefined]){
    assert.throws(()=>assertCandidateSourceIntegrity([{...valid[0],stage}]),/stage or recruiter/);
  }
  assert.throws(()=>assertCandidateSourceIntegrity([{...valid[0],id:" "}]),/stage or recruiter/);
  assert.throws(()=>assertCandidateSourceIntegrity([{...valid[0],assigned_recruiter:" "}]),/stage or recruiter/);
});

test("Dashboard checks complete candidate stage snapshot before publishing KPIs",()=>{
  const src=readFileSync(new URL("../../src/routes/_app.dashboard.tsx",import.meta.url),"utf8");
  assert(src.includes("assertCandidateSourceIntegrity(candAll);"));
  assert(src.includes("if (candAll.length !== totalCand)"));
  assert(src.indexOf("assertCandidateSourceIntegrity(candAll);") < src.indexOf("setStats({ totalCand"));
});

test("Dashboard user-controlled source and assignment keys cannot collide with Object prototype",()=>{
  const src=readFileSync(new URL("../../src/routes/_app.dashboard.tsx",import.meta.url),"utf8");
  assert(src.includes("const srcMap: Record<string, { total: number; joined: number }> = Object.create(null);"));
  assert(src.includes("const rec: Record<string, { count: number; joined: number; name: string }> = Object.create(null);"));
  assert(src.includes("const stageCount: Record<string, number> = Object.create(null);"));
  const map=Object.create(null);
  for(const key of ["__proto__","constructor","toString","standard"]){
    if(!map[key]) map[key]={total:0};
    map[key].total++;
  }
  assert.equal(Object.keys(map).length,4);
  assert.deepEqual(Object.values(map).map(x=>x.total),[1,1,1,1]);
  assert.equal(Object.prototype.total,undefined);
});
