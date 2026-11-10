// Offline-only evidence reconciliation. No database, network or business-record access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function reconcileAuthorization(matrix,evidence){
 const findings=[];
 if(matrix?.status!=='DRAFT_ONLY_NOT_VERIFIED'||!Array.isArray(matrix.tests))findings.push({type:'invalid_matrix'});
 if(!evidence||evidence.fixture_type!=='synthetic'||evidence.environment!=='disposable'||evidence.source_scope!=='approved_schema_equivalent')findings.push({type:'unverified_environment'});
 if(!evidence||typeof evidence.schema_fingerprint!=='string'||!/^sha256:[a-f0-9]{64}$/.test(evidence.schema_fingerprint))findings.push({type:'missing_schema_fingerprint'});
 if(!evidence||typeof evidence.executed_at!=='string'||Number.isNaN(Date.parse(evidence.executed_at)))findings.push({type:'missing_execution_timestamp'});
 if(!evidence||typeof evidence.reviewer!=='string'||!evidence.reviewer.trim())findings.push({type:'missing_reviewer'});
 const expected=new Map((matrix?.tests||[]).map(x=>[x.id,x]));
 const seen=new Set();
 for(const result of evidence?.results||[]){
  if(!result||typeof result.id!=='string'){findings.push({type:'invalid_result'});continue;}
  if(seen.has(result.id))findings.push({type:'duplicate_result',id:result.id});
  seen.add(result.id);
  const planned=expected.get(result.id);
  if(!planned){findings.push({type:'unexpected_result',id:result.id});continue;}
  if(result.actual!=='allow'&&result.actual!=='deny')findings.push({type:'invalid_outcome',id:result.id});
  else if(result.actual!==planned.expected)findings.push({type:'authorization_mismatch',id:result.id,expected:planned.expected,actual:result.actual});
  if(typeof result.evidence_ref!=='string'||!result.evidence_ref.trim())findings.push({type:'missing_evidence_ref',id:result.id});
 }
 for(const id of expected.keys())if(!seen.has(id))findings.push({type:'missing_result',id});
 return {pass:findings.length===0,expected_count:expected.size,recorded_count:seen.size,findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4)throw Error('Usage: node authorization-evidence.mjs matrix.json evidence.json');
  const [matrix,evidence]=process.argv.slice(2).map(x=>JSON.parse(readFileSync(x,'utf8')));
  const result=reconcileAuthorization(matrix,evidence);
  console.log(JSON.stringify(result,null,2));
  if(!result.pass)process.exitCode=1;
 }catch(error){console.error('AUTHORIZATION EVIDENCE BLOCKED:',error.message);process.exitCode=1;}
}
