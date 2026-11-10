import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const views=read('live-view-access-inventory.md');
const functions=read('live-definer-function-inventory.md');
const tables=read('expanded-19-table-security-scope.md');
const metadata=read('metadata-snapshot-readonly.sql');
const extractRows=(text,header)=>text.split('\n').filter(line=>line.startsWith('| ')&&!line.includes('---')&&!line.includes(header)).map(line=>line.split('|')[1]?.trim()).filter(Boolean);
const expectedViews=['available_recruiters','candidates_for_assignment','recruiter_performance','recruiter_performance_with_names','recruiter_stats','recruiter_summary','vw_billing_filters','vw_candidate_filters','vw_client_filters','vw_interview_filters','vw_job_filters','vw_offer_filters','vw_submission_filters'];
const expectedFunctions=['generate_reminders()','get_user_role(_user_id uuid)','handle_new_user()','has_role(_user_id uuid, _role app_role)','is_approved(_user_id uuid)','on_candidate_stage_change()','on_interview_change()','on_offer_change()','on_submission_insert()','resolve_candidate_uuid(_value text)','resolve_client_uuid(_value text)','resolve_job_uuid(_value text)','rls_auto_enable()','run_workflow_rules()','set_assigned_recruiter()','track_stage_changes()'];
test('historical inventory retains all 13 view names without duplicates',()=>{
 const rows=extractRows(views,'View');
 assert.deepEqual(rows,expectedViews);
 assert.equal(new Set(rows).size,13);
});
test('historical inventory retains all 16 SECURITY DEFINER signatures',()=>{
 const rows=extractRows(functions,'Function signature').map(x=>x.replaceAll('`',''));
 assert.deepEqual(rows,expectedFunctions);
 assert.equal(new Set(rows).size,16);
});
test('19-table scope includes all four additional sensitive tables',()=>{
 for(const name of ['app_settings','email_log','workflow_rules','candidate_stage_history']) assert.match(tables,new RegExp('\\b'+name+'\\b'));
 assert.match(tables,/19.*public base tables/);
});
test('read-only metadata recipe can enumerate complete current scope without business rows',()=>{
 for(const expression of ['pg_policies','pg_get_viewdef','pg_get_function_identity_arguments','pg_get_functiondef','has_table_privilege','pg_attribute','pg_constraint'])assert.ok(metadata.includes(expression),expression);
});
