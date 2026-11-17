import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {inspectIndependentCategoryCReview} from "../lead-discovery/acceptance-handoff.mjs";
import {examineCategoryCApprovals} from "../lead-discovery/approval-preflight.mjs";
const dir=join(dirname(fileURLToPath(import.meta.url)),"../lead-discovery");
const read=x=>JSON.parse(readFileSync(join(dir,x),"utf8"));
const clone=x=>JSON.parse(JSON.stringify(x));
const originals=()=>[
 read("lead-policy.review.json"),read("kpi-acceptance.review.json"),
 read("ld02-independent-evidence.review.json"),read("ld05-independent-sample.review.json")
];
const inspect=xs=>inspectIndependentCategoryCReview(...xs);

test("Build168 owner evidence handoff is deliberately unsigned and explicitly names gaps",()=>{
 const s=inspect(originals());
 assert.equal(s.mode,"REVIEW_ONLY_NO_APPROVAL");
 assert.equal(s.formal_category_points,6);
 assert.equal(s.formal_project_points,26);
 assert.equal(s.ld02.accepted,false);
 assert.equal(s.ld05.accepted,false);
 assert(s.ld02.missing.some(x=>x.includes("scope SHA-256")));
 assert(s.ld05.missing.some(x=>x.includes("reconciled aggregate")));
 assert.equal(s.actual_prospects_read+s.external_messages+s.crm_writes,0);
});
test("Build168 standalone CLI checks only draft metadata with no external effects",()=>{
 const x=JSON.parse(execFileSync(process.execPath,[join(dir,"acceptance-handoff.mjs")],{encoding:"utf8"}));
 assert.equal(x.independent_identity_verified,false);
 assert.equal(x.production_enabled,false);
 assert.equal(x.evidence_packets_checked,2);
 assert(/^[a-f0-9]{64}$/.test(x.policy_scope_sha256));
});
test("Build168 fake owner signoff cannot activate a review packet",()=>{
 const a=originals();
 a[2].owner_verification_performed=true;
 assert.throws(()=>inspect(a),/cannot claim owner verification/);
 a[2].owner_verification_performed=false;
 a[3].status="APPROVED";
 assert.throws(()=>inspect(a),/cannot claim owner verification/);
});
test("Build168 policy scope fingerprint cannot be swapped without rejection",()=>{
 const a=originals();
 a[2].approved_scope_sha256="0".repeat(64);
 assert.throws(()=>inspect(a),/signed scope does not match/);
 a[2].approved_scope_sha256="not-a-sha";
 assert.throws(()=>inspect(a),/signed scope does not match/);
});
test("Build168 fake reviewer document link or query token is refused",()=>{
 const a=originals();
 for(const url of ["http://docs.google.com/document/d/x",
  "https://localhost/foo","https://docs.google.com/document/d/x?access_token=private",
  "https://user:pass@github.com/repo/issue","https://attacker.example.org/review"]){
  a[2].growth_owner_independent_review_url=url;
  assert.throws(()=>inspect(a),/invalid LD02/);
 }
});
test("Build168 two approval roles cannot share one signoff reference",()=>{
 const a=originals();
 const ref="https://docs.google.com/document/d/signed-approval";
 a[2].growth_owner_independent_review_url=ref;
 a[2].privacy_owner_independent_review_url=ref;
 assert.throws(()=>inspect(a),/identical signoff/);
});
test("Build168 LD05 duplicate BI and Growth references are rejected",()=>{
 const a=originals();
 const ref="https://github.com/org/repo/issues/21";
 a[3].independent_growth_review_url=ref;
 a[3].independent_bi_review_url=ref;
 assert.throws(()=>inspect(a),/separate/);
});
test("Build168 malformed aggregate, unknown personal data field, and contact count fail closed",()=>{
 const a=originals();
 a[3].data_summary.source_observation_count=-1;
 assert.throws(()=>inspect(a),/nonnegative aggregate/);
 a[3].data_summary.source_observation_count=null;
 a[3].data_summary.person_email="not-allowed@example.com";
 assert.throws(()=>inspect(a),/possible private fields/);
 delete a[3].data_summary.person_email;
 a[3].data_protection.outbound_messages=1;
 assert.throws(()=>inspect(a),/side effects/);
});
test("Build168 contradictory sample population cannot masquerade as verified pilot",()=>{
 const a=originals();
 const c=a[3].data_summary;
 Object.assign(c,{
  source_observation_count:2,unique_business_count:3,verified_public_source_count:2,
  manually_reviewed_business_count:3,qualified_business_count:2,false_positive_count:0,
  duplicates_excluded_count:0,independently_reconciled_mismatch_count:0
 });
 assert.throws(()=>inspect(a),/aggregate consistency/);
});
test("Build168 coherent filled draft does not authenticate reviewer or earn LD points",()=>{
 const a=originals(),x=a[3],p=a[2];
 Object.assign(x.data_summary,{
  source_observation_count:3,unique_business_count:3,verified_public_source_count:3,
  manually_reviewed_business_count:2,qualified_business_count:1,false_positive_count:1,
  duplicates_excluded_count:0,independently_reconciled_mismatch_count:0
 });
 const ref="https://docs.google.com/document/d/example-review";
 x.approved_kpi_policy_url=ref;
 x.independent_growth_review_url="https://github.com/owner/repo/issues/30";
 x.independent_bi_review_url="https://github.com/owner/repo/issues/31";
 x.authorized_business_only_source_approval_url=ref;
 x.independently_checked_aggregate_reference_url=ref;
 x.cutoff_on="2026-11-15";
 p.approved_policy_document_url=ref;
 p.growth_owner_independent_review_url="https://github.com/owner/repo/issues/32";
 p.privacy_owner_independent_review_url="https://github.com/owner/repo/issues/33";
 p.approved_on="2026-11-15";
 const y=inspect(a);
 assert.equal(y.ld02.accepted,false);
 assert.equal(y.ld05.accepted,false);
 assert.equal(y.independent_identity_verified,false);
 assert.equal(y.formal_category_points,6);
 assert.equal(y.production_enabled,false);
});
test("Build168 exact HTTPS business origins only, no path/query or reserved IP",()=>{
 const a=originals(),p=a[0];
 for(const value of ["https://example.com/jobs","https://example.com?token=123",
  "https://example.com/#review","https://127.0.0.1","https://company.local",
  "https://company.internal","https://company.invalid","https://example.com:8443"]){
  p.required_decisions.permitted_public_business_sources=[value];
  assert.throws(()=>examineCategoryCApprovals(p,a[1]),/Invalid or duplicate/,value);
 }
 p.required_decisions.permitted_public_business_sources=["https://company.org"];
 const z=examineCategoryCApprovals(p,a[1]);
 assert.equal(z.LD02.review_fields_complete,false);
 assert.equal(z.LD02.independently_accepted,false);
});
test("Build168 source terms references cannot duplicate or include query secrets",()=>{
 const a=originals();
 a[2].approved_source_terms_document_urls=[
  "https://docs.google.com/document/d/source","https://docs.google.com/document/d/source"];
 assert.throws(()=>inspect(a),/duplicate owner source-terms/);
});
test("Build168 invalid dates cannot claim reviewed sample readiness",()=>{
 const a=originals();
 a[3].cutoff_on="2026-02-30";
 assert.throws(()=>inspect(a),/invalid LD05 cohort cutoff/);
 a[3].cutoff_on=null;
 a[2].approved_on="2026-02-30";
 assert.throws(()=>inspect(a),/invalid LD02 decision date/);
});
test("Build168 category remains frozen: LD02 and LD05 unaccepted, no new points",()=>{
 const rubric=read("fixtures/release-progress/v1-rubric.snapshot.json"),status=read("fixtures/release-progress/build138-current.snapshot.json");
 const completed=new Map(status.statuses.map(s=>[s.id,s.complete]));
 const lead=rubric.milestones.filter(m=>m.group==="LD");
 assert.equal(lead.filter(m=>completed.get(m.id)).reduce((s,m)=>s+m.weight,0),6);
 assert.equal(completed.get("LD02"),false);
 assert.equal(completed.get("LD05"),false);
});
test("Build168 CI verifies offline handoff and keeps no-secret workflows without manual release dispatch",()=>{
 const workflow=readFileSync(join(dir,"../../.github/workflows/build165-category-c.yml"),"utf8");
 assert(workflow.includes("security/build168-lead-category/contract.test.mjs"));
 assert(workflow.includes("node security/lead-discovery/acceptance-handoff.mjs"));
 assert(!workflow.includes("workflow_dispatch:"));
 const files=["acceptance-handoff.mjs","approval-preflight.mjs"];
 for(const f of files){
  const s=readFileSync(join(dir,f),"utf8");
  for(const word of ["fetch(","https.request","http.request","createClient(","sendEmail(","writeFile(","appendFile("])
   assert(!s.includes(word),f+" unsafe call token "+word);
 }
});

test("Build168 owner-handoff status is backed by two unsubmitted forms and six unchanged offline controls",async()=>{
 const {report}=await import("../lead-discovery/category-status.mjs");
 const ledger=read("category-c-v1.json"),policy=read("fixtures/release-progress/v1-rubric.snapshot.json"),
  accepted=read("fixtures/release-progress/build138-current.snapshot.json");
 assert.equal(ledger.latest_build,168);
 assert.equal(ledger.formal_earned_points,6);
 assert.equal(ledger.technical_integrity_controls.length,6);
 assert.equal(ledger.owner_acceptance_handoff.status,"READY_FOR_EXTERNAL_OWNER_INPUT_NOT_APPROVED");
 for(const id of ["LD02","LD05"]){
  assert.equal(ledger.owner_acceptance_handoff[id].submitted,false);
  assert.equal(ledger.owner_acceptance_handoff[id].reviewers_verified,false);
  assert.equal(ledger.owner_acceptance_handoff[id].accepted,false);
 }
 const text=report(policy,accepted,ledger);
 assert.equal(readFileSync(join(dir,"CATEGORY-C-STATUS.md"),"utf8"),text);
 assert(text.includes("Build168 owner decision handoff"));
 assert(text.includes("Not submitted"));
 assert(text.includes("Official acceptance: 6/10"));
});
