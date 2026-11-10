// Validate observations produced by the PostgreSQL policy-model SQL runner.
// These are model outcomes, NEVER approved-schema-equivalent authorization evidence.
import {readFileSync,writeFileSync} from 'node:fs';
const matrix=JSON.parse(readFileSync(new URL('./authorization-acceptance-matrix.json',import.meta.url),'utf8'));
export function reviewSyntheticObservations(lines){
 const expected=new Map(matrix.tests.map(x=>[x.id,x]));
 const findings=[],seen=new Set(),observations=[];
 for(const line of lines){
  if(!line.trim())continue;
  let item;
  try{item=JSON.parse(line);}catch{findings.push('malformed_json');continue;}
  if(!item||typeof item!=='object'||typeof item.id!=='string'){findings.push('invalid_row');continue;}
  if(seen.has(item.id))findings.push('duplicate:'+item.id);
  seen.add(item.id);
  const planned=expected.get(item.id);
  if(!planned){findings.push('unexpected:'+item.id);continue;}
  if(item.case_id!==planned.case_id||item.role!==planned.role||
    item.expected!==planned.expected||item.actual!==planned.expected)
    findings.push('mismatch:'+item.id);
  observations.push(item);
 }
 for(const id of expected.keys())if(!seen.has(id))findings.push('missing:'+id);
 return {
  status:findings.length?'SYNTHETIC_MODEL_FAILED':'SYNTHETIC_MODEL_PASSED',
  context:'disposable PostgreSQL policy model, not production-equivalent',
  release_gate_effect:'none',
  complete_schema_equivalence_verified:false,
  source_scope:'synthetic_policy_model',
  matrix_cases:expected.size,
  sql_cases_observed:observations.length,
  matched:observations.filter(x=>x.actual===x.expected).length,
  findings,
  observations
 };
}
if(process.argv[1]?.endsWith('synthetic-authorization-observation-review.mjs')){
 try{
  if(process.argv.length!==4)throw Error('Usage: node synthetic-authorization-observation-review.mjs observations.ndjson report.json');
  const report=reviewSyntheticObservations(readFileSync(process.argv[2],'utf8').split(/\r?\n/));
  writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,observed:report.sql_cases_observed,matched:report.matched,findings:report.findings.length,release_gate_effect:'none'}));
  if(report.findings.length)process.exitCode=1;
 }catch(e){console.error('SYNTHETIC AUTHORIZATION REPORT FAILED:',e.message);process.exitCode=1;}
}
