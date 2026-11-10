import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSnapshots,SECTIONS} from './schema-parity.mjs';
const sample={
 tables:[{schema_name:'public',object_name:'candidates',rls_enabled:true}],
 columns:[{schema_name:'public',table_name:'candidates',column_name:'id',data_type:'uuid',not_null:true}],
 constraints:[{schema_name:'public',table_name:'candidates',constraint_name:'candidates_pkey',constraint_definition:'PRIMARY KEY (id)'}],
 indexes:[{schema_name:'public',table_name:'candidates',index_name:'candidates_pkey',index_definition:'CREATE UNIQUE INDEX candidates_pkey ON public.candidates USING btree (id)'}],
 views:[{schema_name:'public',view_name:'candidate_view',view_definition:'SELECT id FROM candidates',view_options:['security_invoker=true']}],
 functions:[{schema_name:'public',function_name:'get_role',arguments:'uuid',function_definition:'SELECT 1',security_definer:false}],
 policies:[{schemaname:'public',tablename:'candidates',policyname:'recruiter_read',qual:'assigned_to = auth.uid()'}],
 triggers:[{table_name:'candidates',trigger_name:'track_changes',trigger_definition:'CREATE TRIGGER track_changes'}],
 grants:[{schema_name:'public',object_name:'candidates',role_name:'anon',can_select:false}]
};
const clone=x=>structuredClone(x);
test('equal complete snapshots pass regardless of row property order',()=>{
 const actual=clone(sample);
 actual.tables[0]={rls_enabled:true,object_name:'candidates',schema_name:'public'};
 assert.deepEqual(compareSnapshots(sample,actual),{equal:true,findings:[]});
});
test('missing inventory sections fail closed',()=>{
 const actual=clone(sample);delete actual.grants;
 assert.deepEqual(compareSnapshots(sample,actual).findings.map(x=>x.type),['missing_section']);
});
test('all nine sections detect changed definitions',()=>{
 for(const section of SECTIONS){
  const actual=clone(sample);
  const row=actual[section][0];
  const nonKey=Object.keys(row).at(-1);
  row[nonKey]=JSON.stringify(row[nonKey])+' changed';
  const result=compareSnapshots(sample,actual);
  assert.equal(result.equal,false,section);
  assert.equal(result.findings[0].type,'changed_definition',section);
 }
});
test('unexpected, missing and duplicate objects fail closed',()=>{
 const extra=clone(sample);extra.tables.push({...extra.tables[0],object_name:'unknown'});
 assert.equal(compareSnapshots(sample,extra).findings[0].type,'unexpected_object');
 const missing=clone(sample);missing.views=[];
 assert.equal(compareSnapshots(sample,missing).findings[0].type,'missing_object');
 const duplicate=clone(sample);duplicate.policies.push({...duplicate.policies[0]});
 assert.equal(compareSnapshots(sample,duplicate).findings[0].type,'duplicate_key');
});
test('invalid rows and keys fail closed',()=>{
 const actual=clone(sample);actual.tables.push(null);actual.columns.push({column_name:'missing identifiers'});
 const types=compareSnapshots(sample,actual).findings.map(x=>x.type);
 assert.ok(types.includes('invalid_row'));assert.ok(types.includes('invalid_key'));
});
test('missing both sides of a required section cannot be mistaken for parity',()=>{
 const expected=clone(sample),actual=clone(sample);
 delete expected.triggers;delete actual.triggers;
 assert.equal(compareSnapshots(expected,actual).equal,false);
});

test('zero-argument PostgreSQL function identity is valid and changes are detected',()=>{
 const expected=clone(sample),actual=clone(sample);
 expected.functions[0].arguments='';actual.functions[0].arguments='';
 assert.equal(compareSnapshots(expected,actual).equal,true);
 actual.functions[0].function_definition='SELECT 2';
 assert.equal(compareSnapshots(expected,actual).findings[0].type,'changed_definition');
});
