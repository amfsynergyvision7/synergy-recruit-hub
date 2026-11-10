import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSchemaEquivalence,REQUIRED_SECTIONS} from './schema-equivalence-gate.mjs';
const complete=()=>({environment:'disposable',fixture_type:'synthetic',source_authorization:'explicit_read_only_schema_only',source_scope:'approved_complete_schema',source_fingerprint:'sha256:'+'a'.repeat(64),target_fingerprint:'sha256:'+'a'.repeat(64),catalog_comparison:{equal:true,findings:[]},included_sections:[...REQUIRED_SECTIONS],dependent_schemas_reviewed:true,roles_and_memberships_reviewed:true,extensions_reviewed:true,default_privileges_reviewed:true,ownership_reviewed:true,functions_and_triggers_reviewed:true,migration_rollback_rehearsed:true,independent_review_completed:true,evidence_reference:'synthetic-fixture-only'});
test('unverified source cannot be used for authorization execution',()=>{
 const result=assessSchemaEquivalence({});
 assert.equal(result.ready_for_authorization_execution,false);
 assert.ok(result.issues.length>=10);
});
test('complete synthetic contract is structurally accepted without certifying actual evidence',()=>{
 assert.deepEqual(assessSchemaEquivalence(complete()),{ready_for_authorization_execution:true,issues:[]});
});
test('each missing provenance and review prerequisite fails independently',()=>{
 for(const key of ['environment','fixture_type','source_authorization','source_scope','source_fingerprint','target_fingerprint','catalog_comparison','included_sections','dependent_schemas_reviewed','roles_and_memberships_reviewed','extensions_reviewed','default_privileges_reviewed','ownership_reviewed','functions_and_triggers_reviewed','migration_rollback_rehearsed','independent_review_completed','evidence_reference']){
  const x=complete();delete x[key];
  assert.equal(assessSchemaEquivalence(x).ready_for_authorization_execution,false,key);
 }
});
test('fingerprint and catalog drift are rejected',()=>{
 const x=complete();x.target_fingerprint='sha256:'+'b'.repeat(64);
 assert.ok(assessSchemaEquivalence(x).issues.includes('fingerprint_mismatch'));
 x.target_fingerprint=x.source_fingerprint;x.catalog_comparison.findings.push({section:'grants',type:'changed_definition'});
 assert.ok(assessSchemaEquivalence(x).issues.includes('catalog_not_equal'));
});
