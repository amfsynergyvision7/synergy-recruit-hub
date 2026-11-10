// Offline-only provenance gate. Does not connect to databases or certify a release.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const REQUIRED_SECTIONS=['tables','columns','constraints','indexes','views','functions','policies','triggers','grants'];
export function assessSchemaEquivalence(input){
 const issues=[];
 if(input?.environment!=='disposable')issues.push('environment_not_disposable');
 if(input?.fixture_type!=='synthetic')issues.push('fixture_not_synthetic');
 if(input?.source_authorization!=='explicit_read_only_schema_only')issues.push('source_authorization_missing');
 if(input?.source_scope!=='approved_complete_schema')issues.push('source_scope_unapproved');
 if(!/^sha256:[a-f0-9]{64}$/.test(input?.source_fingerprint||''))issues.push('source_fingerprint_missing');
 if(!/^sha256:[a-f0-9]{64}$/.test(input?.target_fingerprint||''))issues.push('target_fingerprint_missing');
 if(input?.source_fingerprint!==input?.target_fingerprint)issues.push('fingerprint_mismatch');
 if(input?.catalog_comparison?.equal!==true||!Array.isArray(input?.catalog_comparison?.findings)||input.catalog_comparison.findings.length!==0)issues.push('catalog_not_equal');
 if(!Array.isArray(input?.included_sections)||REQUIRED_SECTIONS.some(x=>!input.included_sections.includes(x)))issues.push('catalog_sections_incomplete');
 for(const key of ['dependent_schemas_reviewed','roles_and_memberships_reviewed','extensions_reviewed','default_privileges_reviewed','ownership_reviewed','functions_and_triggers_reviewed','migration_rollback_rehearsed','independent_review_completed']){
  if(input?.[key]!==true)issues.push(key+'_missing');
 }
 if(typeof input?.evidence_reference!=='string'||!input.evidence_reference.trim())issues.push('evidence_reference_missing');
 return {ready_for_authorization_execution:issues.length===0,issues};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node schema-equivalence-gate.mjs evidence.json');
  const result=assessSchemaEquivalence(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(result,null,2));
  if(!result.ready_for_authorization_execution)process.exitCode=1;
 }catch(e){console.error('SCHEMA EQUIVALENCE BLOCKED:',e.message);process.exitCode=1;}
}
