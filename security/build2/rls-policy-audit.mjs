// Offline-only policy metadata checker. No database client, network or credentials.
// Input is an exported JSON array of pg_policies metadata, NOT business records.
// Usage: node security/build2/rls-policy-audit.mjs ./policies-metadata.json
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const sensitiveTables = Object.freeze(['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']);
export function auditPolicies(policies) {
  if (!Array.isArray(policies)) throw new TypeError('Expected metadata policy array');
  const findings=[];
  for(const p of policies) {
    if(p.schemaname!=='public') continue;
    const roles=Array.isArray(p.roles)?p.roles:typeof p.roles==='string'?p.roles.replace(/[{}]/g,'').split(','):[];
    const unconditional=String(p.qual??'').trim().replace(/^\((.*)\)$/,'$1').trim().toLowerCase()==='true';
    const broad=(p.permissive==='PERMISSIVE' && (p.cmd==='ALL'||p.cmd==='SELECT') && unconditional && roles.some(x=>['public','anon','authenticated'].includes(String(x).toLowerCase())));
    if(broad) findings.push({table:p.tablename,policy:p.policyname,command:p.cmd,roles});
  }
  const affected=[...new Set(findings.map(f=>f.table))].sort();
  return {findings,affected,critical:affected.filter(t=>sensitiveTables.includes(t)),safe:findings.length===0};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const file=process.argv[2];if(!file){console.error('Pass path to policy metadata JSON');process.exitCode=2;}
  else {const result=auditPolicies(JSON.parse(readFileSync(file,'utf8')));console.log(JSON.stringify(result,null,2));if(!result.safe)process.exitCode=1;}
}
