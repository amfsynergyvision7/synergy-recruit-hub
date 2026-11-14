import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluate, compareSnapshots } from "../release-progress/score.mjs";
const read=name=>JSON.parse(readFileSync(new URL("../release-progress/"+name,import.meta.url),"utf8"));
const rubric=read("v1-rubric.json"),prior=read("build127-evidence-baseline.json"),current=read("build128-evidence-baseline.json");

test("Build128 unchanged programme score is exactly 26/100",()=>{
 assert.equal(prior.snapshot_build,127);
 assert.equal(current.snapshot_build,128);
 assert.equal(current.previous_file,"build127-evidence-baseline.json");
 assert.deepEqual(compareSnapshots(rubric,prior,current),{
  previous:26,current:26,delta:0,newGates:[],regressed:[]
 });
 assert.equal(evaluate(rubric,current).completed_milestones,12);
 assert.equal(evaluate(rubric,current).remaining,74);
});

test("Build128 cannot overwrite historical accepted states or 43-gate weights",()=>{
 assert.equal(current.statuses.length,43);
 const old=new Map(prior.statuses.map(g=>[g.id,g.complete]));
 for(const row of current.statuses) assert.equal(row.complete,old.get(row.id),row.id);
 assert.equal(evaluate(rubric,current).closedWorkstreams,0);
});

test("Build128 source hardening is not miscredited as hosted RLS review",()=>{
 const x=current.observations.shared_crud_read_hardening;
 assert.equal(x.stage,"DRAFT_CLIENT_DEFENCE_IN_DEPTH_NOT_ACCEPTED_RLS");
 assert.equal(x.verified_subject_role_keying,true);
 assert.equal(x.main_list_bound,250);
 assert.equal(x.relation_list_bound,250);
 assert.equal(x.exact_counts_required,true);
 assert.equal(x.duplicate_ids_rejected,true);
 assert.equal(x.unscoped_realtime_subscriptions,0);
 assert.equal(x.accepted_hosted_role_rls,false);
 assert.equal(x.signed_hosted_uat,0);
});

test("Build128 offline parser does not unlock imports, personal data or finance",()=>{
 const x=current.observations.import_format_hardening;
 assert.equal(x.detects_papaparse_renamed_headers,true);
 assert.equal(x.verifies_sheetjs_fullref,true);
 assert.equal(x.rejects_multi_sheet_workbooks,true);
 assert.equal(x.finite_numbers_only,true);
 assert.equal(x.canonical_iso_dates_only,true);
 assert.equal(x.real_crm_imports_executed,0);
 assert.equal(x.production_writes,0);
});

test("Build128 lab and release signoffs remain unaccepted",()=>{
 const x=current.observations.build128_evidence;
 assert.equal(x.nonprod_lab_auth_users,0);
 assert.equal(x.nonprod_lab_rows,0);
 assert.equal(x.nonprod_lab_public_rls_policies,0);
 assert.equal(x.nonprod_lab_rls_enabled_tables,19);
 assert.equal(x.release_gate_signoffs,0);
 assert.equal(current.observations.git.main_protected,false);
 assert.equal(current.observations.git.pr12_merged,false);
 assert.equal(current.observations.git.pr15_merged,false);
 for(const id of ["CRM05","CRM06","CRM07","CRM08","CRM09","CRM10","REL01","REL02",
                   "REL03","REL04","REL05","REL06","REL07"])
  assert.equal(current.statuses.find(y=>y.id===id)?.complete,false,id);
});

test("Build128 fabricated acceptance with missing evidence is rejected",()=>{
 const fake=structuredClone(current);
 const rec=fake.statuses.find(s=>s.id==="CRM08");
 rec.complete=true; rec.evidence=[];
 assert.throws(()=>evaluate(rubric,fake),/Completed gate lacks evidence/);
});
