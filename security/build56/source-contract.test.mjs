import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const guard=read("security/build56/financial-joined-transition-hold-review-only.sql");
const testSource=read("security/build56/production-financial-source.integration.sql");
const fp=read("security/build56/live-financial-dependency-preflight.sql");
test("Build56 blocks joined candidate/offer entry and reversion before source billing",()=>{
 assert.match(guard,/SECURITY INVOKER SET search_path=pg_catalog,public/);
 assert.match(guard,/TG_TABLE_NAME='candidates'/);
 assert.match(guard,/TG_TABLE_NAME='offers'/);
 assert.match(guard,/NEW\.stage::text='joined'/);
 assert.match(guard,/OLD\.stage::text='joined'/);
 assert.match(guard,/NEW\.joining_status='joined'/);
 assert.match(guard,/OLD\.joining_status='joined'/);
 assert.match(guard,/BEFORE INSERT OR UPDATE OF stage ON public\.candidates/);
 assert.match(guard,/BEFORE INSERT OR UPDATE OF joining_status,offer_status ON public\.offers/);
 assert.doesNotMatch(guard,/current_setting\(|set_config\(|app\.finance_override/);
});
test("actual source-shaped financial fixture proves legacy duplicate risk and hold",()=>{
 assert.match(testSource,/DO \$b56_legacy_double_billing\$/);
 assert.match(testSource,/DO \$b56_guard_assertions\$/);
 assert.match(testSource,/expected exactly TWO invoices/i);
 assert.match(testSource,/candidate_uuid\s*=\s*NEW\.id/);
 assert.match(testSource,/ROUND\(COALESCE\(NEW\.salary, NEW\.ctc, 0\) \* 0\.0833/);
 assert.match(testSource,/ROLLBACK;/);
 assert.equal((testSource.match(/^COMMIT;$/gm)||[]).length,0);
});
test("live functions and two specific trigger definitions fingerprinted read-only",()=>{
 assert.match(fp,/4185f4991651dfabc801b631939a7170/);
 assert.match(fp,/05ca5a63bd7e8bc14544a25d0d8475a9/);
 assert.match(fp,/DRIFT_BLOCK_RELEASE/);
 const noComments=fp.replace(/^--.*$/gm,"");
 assert.doesNotMatch(noComments,/\b(?:CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE\s+public|DELETE|COMMIT|GRANT|REVOKE)\s+/i);
});

test("browser offer joined status remains disabled and bulk guarded without backend bypass",()=>{
 const safety=read("src/lib/release-safety.ts");
 const crud=read("src/components/CrudModule.tsx");
 const offers=read("src/routes/_app.offers.tsx");
 assert.match(safety,/LEGACY_JOINED_FINANCIAL_TRANSITIONS_PAUSED = true as const/);
 assert.match(crud,/form\.joining_status === "joined" \|\| editing\?\.joining_status === "joined"/);
 assert.match(crud,/row\.joining_status === "joined"/);
 assert.match(crud,/field\.name === "joining_status" && bulkEditValue === "joined"/);
 assert.match(crud,/toast\.error\(FINANCIAL_JOINED_HOLD_REASON\)/);
 assert.doesNotMatch(offers,/\{ value:"joined", label:"Joined" \}/);
 assert.match(offers,/Joined transitions and automatic billing require separate financial approval/);
});

test("billing UI remains read-only until separate finance approval",()=>{
 const safety=read("src/lib/release-safety.ts");
 const crud=read("src/components/CrudModule.tsx");
 const billing=read("src/routes/_app.billing.tsx");
 assert.match(safety,/LEGACY_BILLING_MUTATIONS_PAUSED = true as const/);
 assert.match(crud,/billingMutationPaused = module === "billing" && LEGACY_BILLING_MUTATIONS_PAUSED/);
 assert.match(crud,/!candidateMutationPaused && !billingMutationPaused/);
 assert.match(crud,/if \(billingMutationPaused\) \{ toast\.error\(BILLING_MUTATION_HOLD_REASON\); return; \}/);
 assert.match(crud,/\{billingMutationPaused && <Badge/);
 assert.match(billing,/Financial changes are paused pending separate finance approval/);
});
