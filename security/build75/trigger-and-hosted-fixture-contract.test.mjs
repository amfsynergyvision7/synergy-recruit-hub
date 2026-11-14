import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const source=json("security/build75/live-trigger-and-auth-hook-manifest.json");
const plan=json("security/build69/complete-19-fixture-blueprint.json");
const scope=json("security/build65/production-hosted-coverage.json");
const accounts=json("security/build69/synthetic-fixture-blueprint.json").hosted_account_slots;
const matrix=json("security/build41/signed-http-135-read-matrix.json");
const pre=read("security/build75/isolated-hosted-preseed.readonly.sql");
const after=read("security/build75/isolated-hosted-postseed.readonly.sql");
const replay=read("security/build75/auth-autoprofile-and-nine-slot.rollback.sql");
const observation=json("security/build75/live-nonprod-preseed-observation.json");
const identities=[...new Set(matrix.read_cases.map(c=>c.sub))];
test("production catalog source pins all thirty-two table-qualified triggers including ten workflow/lifecycle hooks",()=>{
 assert.equal(source.evidence_type,"LIVE_SOURCE_PINNED_32_PUBLIC_TRIGGERS_AND_AUTH_USERS_BOOTSTRAP_AUDIT");
 assert.equal(source.app_trigger_count,32);
 assert.equal(source.app_trigger_table_count,12);
 assert.equal(source.application_triggers.length,32);
 assert.equal(source.workflow_triggers.length,6);
 assert.equal(source.lifecycle_triggers.length,4);
 assert.equal(source.other_side_effect_sensitive_triggers.length,4);
 assert.equal(source.live_personal_rows_queried,0);
 assert.equal(source.live_database_writes,0);
 const tuple=t=>t.table_name+"\0"+t.trigger_name;
 const planned=plan.ordered_table_plans.flatMap(t=>t.app_trigger_names.map(name=>t.table+"\0"+name));
 assert.equal(planned.length,32);
 assert.deepEqual(new Set(source.application_triggers.map(tuple)),new Set(planned));
 assert.ok(source.application_triggers.every(t=>t.enabled_mode==="O"&&
  /^[0-9a-f]{32}$/.test(t.trigger_md5)&&/^[0-9a-f]{32}$/.test(t.function_md5)));
 assert.equal(source.application_triggers.filter(t=>t.privileged_function).length,12);
});
test("auth user creation hook is source verified and its hardcoded privileged email is NOT exported",()=>{
 assert.equal(source.auth_user_trigger_count,1);
 const [hook]=source.auth_user_triggers;
 assert.equal(hook.trigger_name,"on_auth_user_created");
 assert.equal(hook.function_signature,"handle_new_user()");
 assert.equal(hook.enabled_mode,"O");
 assert.equal(hook.privileged_function,true);
 assert.equal(hook.inserts_profile,true);
 assert.equal(hook.inserts_role,true);
 assert.equal(hook.email_condition,true);
 assert.equal(hook.privileged_email_branch,true);
 assert.equal(source.auth_hook_unconditionally_inserts_profile_and_role,true);
 assert.equal(source.auth_hook_has_hardcoded_privileged_email_branch,true);
 assert.equal(source.hardcoded_email_value_saved,false);
 assert.match(hook.trigger_md5,/^[0-9a-f]{32}$/);
 assert.match(hook.function_md5,/^[0-9a-f]{32}$/);
 assert.doesNotMatch(JSON.stringify(source),/@/);
});
test("source-fingerprinted nonprod preseeding gate is SELECT-only, exact 19/13/32 and fails closed",()=>{
 assert.equal(scope.production_public_tables.length,19);
 assert.equal(scope.production_public_views.length,13);
 for(const t of scope.production_public_tables)assert.ok(pre.includes("('"+t+"')"),t);
 for(const v of scope.production_public_views)assert.ok(pre.includes("('"+v+"')"),v);
 for(const t of source.application_triggers){
  const tuple="('"+t.table_name+"','"+t.trigger_name+"','"+t.trigger_md5+"','"+t.function_md5+"')";
  assert.ok(pre.includes(tuple),tuple);
 }
 assert.equal((pre.match(/^[ \t]*\('[a-z_]+','[a-z_]+','[0-9a-f]{32}','[0-9a-f]{32}'\)/gm)||[]).length,32);
 for(const condition of [
  "matched_tables=19","actual_public_tables=19","rls_enabled_tables=19",
  "anon_truncate_tables=0","authenticated_truncate_tables=0",
  "matched_views=13","actual_public_views=13","invoker_views=13",
  "anon_readable_views=0","actual_app_triggers=32","source_exact_app_triggers=32",
  "not_disabled_app_triggers=0","auth_user_hooks=0","auth_user_count=0",
  "HOLD_NONPROD_PRESEED_SCHEMA_TRIGGER_AUTH_OR_GRANTS",
  "TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION"
 ])assert.ok(pre.includes(condition),"missing fail-close "+condition);
 assert.match(pre,/^WITH expected_tables\(name\) AS \(VALUES/m);
 const noComments=pre.replace(/^\s*--.*$/gm,"").trim();
 assert.doesNotMatch(noComments,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER|GRANT|REVOKE|COMMIT|CALL)\s+(?:INTO|TABLE|FUNCTION|ON|SCHEMA|USER|ROLE)/im);
 assert.equal((noComments.match(/;/g)||[]).length,1);
 assert.ok(!pre.includes("SELECT * FROM public.candidates"));
});
test("dedicated UAT nonproduction real read-only gate remains HOLD with no accounts or CRM schema",()=>{
 assert.equal(observation.evidence_type,"EXECUTED_READONLY_DEDICATED_NONPROD_HOSTED_PRESEED_GATE");
 assert.equal(observation.project_ref,"dhlhlasnaapzckjyvffn");
 assert.equal(observation.catalog_only,true);
 assert.match(observation.source_blob_sha,/^[a-f0-9]{40}$/);
 assert.equal(observation.results.seed_gate,"HOLD_NONPROD_PRESEED_SCHEMA_TRIGGER_AUTH_OR_GRANTS");
 for(const c of ["matched_tables","actual_public_tables","matched_views","actual_public_views",
 "actual_app_triggers","source_exact_app_triggers","not_disabled_app_triggers","auth_user_hooks","auth_user_count"])
  assert.equal(observation.results[c],0,c);
 assert.equal(observation.actual_hosted_users_created,0);
 assert.equal(observation.actual_hosted_cases_accepted,0);
 assert.equal(observation.sql_write_count,0);
});
test("postseed read-only query enforces full nine-slot role/status and candidate-ID ownership integrity",()=>{
 assert.equal(accounts.length,9);
 assert.equal(identities.length,9);
 assert.equal(accounts.filter(a=>a.profile_record_required).length,8);
 assert.equal(accounts.filter(a=>a.user_role_record_required).length,8);
 assert.equal(accounts[8].profile_record_required,false);
 assert.equal(accounts[8].user_role_record_required,false);
 assert.equal(accounts.filter(a=>a.expected_role==="recruiter"&&a.profile_status==="approved"&&a.profile_active).length,2);
 for(const criterion of [
 "auth_users=9","non_synthetic_email_domains=0","profile_rows=8","user_role_rows=8",
 "auth_without_profile_and_role=1","partially_profiled_auth_users=0","orphan_profiles=0",
 "orphan_roles=0","role_status_group_mismatches=0","candidate_rows=2",
 "correctly_owned_safe_candidate_rows=2",
 "HOSTED_SYNTHETIC_FIXTURE_CONSISTENT_NOT_FORMAL_AUTH_ACCEPTANCE",
 "HOLD_HOSTED_FIXTURE_ROLE_PROFILE_OWNER_INTEGRITY"
 ])assert.ok(after.includes(criterion),criterion);
 assert.match(after,/lower\(split_part\(email,'@',2\)\)<>'example\.invalid'/);
 assert.match(after,/c\.id=c\.assigned_recruiter/);
 assert.match(after,/c\.stage::text NOT IN \('joined','offer_released'\)/);
 assert.doesNotMatch(after,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER TABLE)\s+(?:INTO|TABLE|FROM|public)/i);
});
test("real PostgreSQL authentication-hook simulation tests 9/8/8 positive and three negative cases only in rollback",()=>{
 assert.match(replay,/^-- Build75: disposable PostgreSQL 17 only/);
 assert.match(replay,/current_database\(\)<>'amf_build75_auth_lab'/);
 assert.match(replay,/CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth\.users/);
 assert.match(replay,/ALTER TABLE auth\.users DISABLE TRIGGER on_auth_user_created/);
 assert.match(replay,/Active auth hook did not automatically profile\/role/);
 assert.match(replay,/Unexpectedly accepted a profiled ninth synthetic identity/);
 assert.match(replay,/Unexpectedly accepted finance-owned synthetic recruiter candidate/);
 assert.match(replay,/Unexpectedly accepted non-synthetic account domain/);
 assert.match(replay,/Safe fixture not restored after negative rollback/);
 for(const id of identities)assert.ok(replay.includes("'"+id+"'"),"historical synthetic slot lost");
 assert.equal((replay.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((replay.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.equal((replay.match(/^COMMIT;$/gm)||[]).length,0);
 assert.match(replay,/ROLLBACK;\s*$/);
 assert.ok(!replay.includes("wusntntcqgtpgokggdzv"));
 assert.ok(!replay.includes("dhlhlasnaapzckjyvffn"));
 assert.doesNotMatch(replay,/@gmail\.com|@outlook\.com|@yahoo\./i);
});
