// Read-only static inventory; never runs SQL or connects to a database.
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export function auditMigrationDirectory(dir){
 const files=readdirSync(dir).filter(x=>/^\d{14}_.+\.sql$/.test(x)).sort();
 const findings=[];const inventory=[];
 for(const name of files){
  const sql=readFileSync(join(dir,name),'utf8');
  const count=re=>[...sql.matchAll(re)].length;
  const indicators={
   security_definer:count(/\bSECURITY\s+DEFINER\b/gi),
   create_policy:count(/\bCREATE\s+POLICY\b/gi),
   create_trigger:count(/\bCREATE\s+(?:CONSTRAINT\s+)?TRIGGER\b/gi),
   create_function:count(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/gi),
   create_table:count(/\bCREATE\s+TABLE\b/gi),
   drop_object:count(/\bDROP\s+(?:TABLE|VIEW|FUNCTION|TRIGGER|POLICY|TYPE)\b/gi),
   grant:count(/\bGRANT\b/gi),
   references_auth: /\bauth\./i.test(sql),
   references_storage: /\bstorage\./i.test(sql),
   workflow_financial_terms:/\b(billing|payment_status|gst|fee_amount|joining_status)\b/i.test(sql),
   dynamic_sql:/\bEXECUTE\s+(?:format\s*\(|['"]|\w+\s*;)/i.test(sql)
  };
  if(indicators.drop_object)findings.push({file:name,type:'destructive_ddl_review',count:indicators.drop_object});
  if(indicators.security_definer)findings.push({file:name,type:'definer_privilege_review',count:indicators.security_definer});
  if(indicators.workflow_financial_terms)findings.push({file:name,type:'financial_side_effect_review'});
  if(indicators.references_auth||indicators.references_storage)findings.push({file:name,type:'external_schema_dependency_review'});
  inventory.push({file:name,sha256:createHash('sha256').update(sql).digest('hex'),bytes:Buffer.byteLength(sql),indicators});
 }
 return {status:'STATIC_SOURCE_ONLY_NOT_REPLAYED',files:inventory.length,inventory,findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Usage: node migration-source-audit.mjs path/to/migrations');
  console.log(JSON.stringify(auditMigrationDirectory(process.argv[2]),null,2));
 }catch(e){console.error('MIGRATION SOURCE AUDIT ERROR:',e.message);process.exitCode=1;}
}
