import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const report=src("src/routes/_app.reports.tsx");
const dash=src("src/routes/_app.dashboard.tsx");
const helper=src("src/lib/bounded-report-read.ts");

test("Build124 full report pipeline is allowed only for approved account with current role",()=>{
 assert(report.includes("const allowed = canReadPipelineReports(user?.id, profile, role)"));
 assert(report.includes('queryKey: ["reports-data", user?.id ?? "signed-out", role ?? "none"]'));
 assert(report.includes("enabled: allowed"));
 assert(report.includes('if (!allowed) throw new Error("Reporting requires an approved account and role")'));
});
test("Build124 every report source has exact count, ID order and page ranges",()=>{
 for(const table of ["candidates","submissions","interviews","offers","clients"]){
  const i=report.indexOf('supabase.from("'+table+'")');
  assert(i>=0,table);
  const after=report.slice(i,i+390);
  assert(after.includes('{ count: "exact" }'),table);
  assert(after.includes('.order("id", { ascending: true }).range(from, to).abortSignal(abort)'),table);
 }
 assert.equal((report.match(/readBoundedReportRows\(/g)||[]).length,5);
});
test("Build124 recruitment report fetch removes unneeded global full-name directory and salary data",()=>{
 assert(!report.includes('supabase.from("profiles")'));
 assert(!report.includes('supabase.from("billing")'));
 assert(!report.includes('ctc, salary'));
 assert(!report.includes("data?.profiles"));
 assert(report.includes('headers={["Recruiter (ID)"'));
});
test("Build124 report emits no CSV on failed or incomplete data",()=>{
 assert(report.includes("if (isError)"));
 assert(report.includes("Unable to load authorized reports."));
 assert(report.includes("Unable to retrieve authorized reporting data"));
 assert(report.includes('disabled={loading || rows.length === 0}'));
 assert(report.includes("readBoundedReportRows"));
});
test("Build124 dashboard is authorized and all eight aggregate counts are explicitly validated",()=>{
 assert(dash.includes("const allowed = canReadPipelineReports(user?.id, profile, role)"));
 assert(dash.includes('count: "exact", head: true'));
 assert(dash.includes("Dashboard source counts are unavailable"));
 assert(dash.includes("setFailed(true)"));
 assert(dash.includes("if (failed) return ("));
 assert(!dash.includes('supabase.from("billing")'));
});
test("Build124 dashboard candidate and offer source arrays are complete, bounded and ordered",()=>{
 assert.equal((dash.match(/readBoundedReportRows\(/g)||[]).length,2);
 for(const table of ["candidates","offers"]){
  const x=dash.indexOf('readBoundedReportRows((from,to,abort)=>\n        supabase.from("'+table+'")');
  assert(x>=0,table);
  const section=dash.slice(x,x+370);
  assert(section.includes('{ count: "exact" }'),table);
  assert(section.includes('.order("id", { ascending: true }).range(from,to).abortSignal(abort)'),table);
 }
});
test("Build124 dashboard removes delayed request race and aborts previous in-flight HTTP reads",()=>{
 assert(dash.includes("let latest = 0;"));
 assert(dash.includes("const request = ++latest;"));
 assert(dash.includes("controller?.abort();"));
 assert(dash.includes("controller = new AbortController();"));
 assert(dash.includes("request === latest && !signal.aborted"));
 assert(dash.includes("active = false;"));
 assert(dash.includes("controller?.abort();"));
});
test("Build124 dashboard errors clear metrics instead of showing believable zeros",()=>{
 assert(dash.includes("setFailed(true);"));
 assert(dash.includes("setStats({});"));
 assert(dash.includes("setMonthly([]);"));
 assert(dash.includes("setFunnel([]);"));
 assert(dash.includes("setRecruiters([]);"));
 assert(dash.includes("Dashboard totals could not be verified"));
});
test("Build124 dashboard fetches reviewer profile names only for relevant recruiter IDs",()=>{
 assert(dash.includes(".in('id', recruiterIds)"));
 assert(dash.includes("recruiterIds.length > 100"));
 assert(dash.includes(".abortSignal(signal)"));
 assert(dash.includes("Recruiter metadata unavailable"));
 assert(!dash.includes('supabase.from("billing")'));
});
test("Build124 paging adapter is intrinsically read-only, with no write or privileged client",()=>{
 for(const bad of ["createClient(","service_role","insert(","upsert(","update(","delete(","fetch(","writeFile(","process.env"])
  assert(!helper.includes(bad),bad);
 assert(helper.includes("REPORT_PAGE_SIZE = 250"));
 assert(helper.includes("REPORT_MAX_ROWS = 2500"));
});
