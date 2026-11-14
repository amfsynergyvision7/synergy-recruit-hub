import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 FINANCIAL_ANALYTICS_RELEASE_HOLD, canReadPipelineReports, canReadAuditLogs,
 canReadFinancialAnalytics
} from "../../src/lib/crm-report-access.ts";
import { rowsToCsv } from "../../src/lib/csv.ts";
const file=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const profile={id:"auth-1",status:"approved",is_active:true};
test("Build123 reporting requires the exact current approved signed Auth identity",()=>{
 for(const r of ["admin","recruiter","operations"])
   assert.equal(canReadPipelineReports("auth-1",profile,r),true);
 for(const r of ["viewer","finance",null,"anything"])
   assert.equal(canReadPipelineReports("auth-1",profile,r),false);
 for(const invalid of [null,undefined,"auth-2",""])
   assert.equal(canReadPipelineReports(invalid,profile,"admin"),false);
 for(const status of ["suspended","pending","rejected"])
   assert.equal(canReadPipelineReports("auth-1",{...profile,status},"admin"),false);
 assert.equal(canReadPipelineReports("auth-1",{...profile,is_active:false},"admin"),false);
});
test("Build123 audit logs require administrator, not ordinary reader or finance",()=>{
 assert(canReadAuditLogs("auth-1",profile,"admin"));
 for(const role of ["recruiter","operations","finance","viewer",null])
   assert.equal(canReadAuditLogs("auth-1",profile,role),false);
 assert.equal(canReadAuditLogs("auth-2",profile,"admin"),false);
});
test("Build123 financial analytics are unconditionally held for every role",()=>{
 assert.equal(FINANCIAL_ANALYTICS_RELEASE_HOLD,true);
 for(const role of ["admin","finance","viewer","recruiter","operations",null])
   assert.equal(canReadFinancialAnalytics("auth-1",profile,role),false);
 const policy=file("src/lib/crm-report-access.ts");
 assert(!/import\.meta\.env|process\.env|localStorage|sessionStorage/.test(policy));
});
test("Build123 CSV neutralizes spreadsheet commands without corrupting numeric values",()=>{
 const csv=rowsToCsv(["Company","Invoice"],[
 ["=HYPERLINK(\"https://malicious.invalid\",\"click\")",-125],
 ["+SUM(1,1)",0],
 ["@NOW()",42],
 ["-2+3",8],
 ["  =2+2",99],
 ["\u200b=IMPORTXML(\"https://bad.invalid\",\"//p\")",3],
 ]);
 assert(csv.includes("'=HYPERLINK"));
 assert(csv.includes("'+SUM(1,1)"));
 assert(csv.includes("'@NOW()"));
 assert(csv.includes("'-2+3"));
 assert(csv.includes("'  =2+2"));
 assert(csv.includes("'\u200b=IMPORTXML"));
 assert(csv.includes(",-125"));
 assert(!csv.includes(',"=HYPERLINK'));
});
test("Build123 ordinary spreadsheet CSV values stay RFC4180 quoted and number-shaped",()=>{
 const csv=rowsToCsv(["Name","Count"],[["Acme, Inc.",3],["John \"quoted\" Doe",2],["Business\nTwo",1]]);
 assert(csv.includes('"Acme, Inc.",3'));
 assert(csv.includes('"John ""quoted"" Doe",2'));
 assert(csv.includes('"Business\nTwo",1'));
 assert(csv.includes("\r\n"));
});
test("Build123 audit direct navigation fails closed before any Supabase data read",()=>{
 const audit=file("src/routes/_app.audit.tsx");
 assert(audit.includes("canReadAuditLogs(user?.id, profile, role)"));
 assert(audit.includes("if (!allowed) return () => { active = false; };"));
 assert(audit.includes('select("id, created_at, user_id, action, table_name, record_id")'));
 assert(!audit.includes('select("*")'));
 assert(!audit.includes("r.user_email"));
 assert(audit.includes("if (!allowed) return <p"));
});
test("Build123 billing direct route remains held before mounting CrudModule",()=>{
 const page=file("src/routes/_app.billing.tsx");
 assert(page.includes("canReadFinancialAnalytics(user?.id, profile, role)"));
 assert(page.indexOf("if (!canReadFinancialAnalytics(")<page.indexOf("return (\n    <CrudModule"));
 assert(page.includes("Billing and financial reporting are paused"));
});
test("Build123 sidebar hides withheld financial and audit destinations",()=>{
 const src=file("src/components/AppSidebar.tsx");
 for(const predicate of ["canReadPipelineReports(user?.id, profile, role)",
                         "canReadAuditLogs(user?.id, profile, role)",
                         "canReadFinancialAnalytics(user?.id, profile, role)"])
   assert(src.includes(predicate));
 assert(src.includes("shownItems.map((item)"));
});


test("Build123 reports are role-gated, identity-bound and avoid finance fetches or exports",()=>{
 const src=file("src/routes/_app.reports.tsx");
 assert(src.includes("const allowed = canReadPipelineReports(user?.id, profile, role);"));
 assert(src.includes('queryKey: ["reports-data", user?.id ?? "signed-out", role ?? "none"]'));
 assert(src.includes("enabled: allowed"));
 assert(src.includes('if (!allowed) throw new Error("Reporting requires an approved account and role")'));
 assert(src.includes("if (isError)"));
 assert(!src.includes('supabase.from("billing")'));
 assert(!src.includes("ctc, salary"));
 assert(!src.includes('filenamePrefix="billing-summary"'));
 assert(!src.includes('title="Billing Summary by Client"'));
 assert(src.includes("Unable to retrieve authorized reporting data"));
});
