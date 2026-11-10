// Offline-only policy metadata checker. No database client, network or credentials.
// Usage: node security/build2/rls-policy-audit.mjs ./policies-metadata.json
// A clean report means no *obvious unconditional* broad policies; it is NOT proof
// of role, record, grant, view, function or tenant security.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const sensitiveTables = Object.freeze(['audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles']);

function parseRoles(roles) {
  const raw = Array.isArray(roles) ? roles : typeof roles === 'string' ? roles.replace(/^\{|\}$/g, '').split(',') : [];
  return raw.map(r=>String(r).trim().replace(/^["']|["']$/g,'').toLowerCase()).filter(Boolean);
}
function isUnconditionalTrue(value) {
  if (typeof value !== 'string' && typeof value !== 'boolean') return false;
  let s=String(value).trim().toLowerCase();
  // Handle pg_policies formatting: true, (true), ((true)), true::boolean.
  for (let n=0;n<10 && s.startsWith('(') && s.endsWith(')');n++) s=s.slice(1,-1).trim();
  return /^(?:true|true::boolean|\(true\)::boolean)$/.test(s);
}
export function auditPolicies(policies) {
  if (!Array.isArray(policies)) throw new TypeError('Expected metadata policy array');
  const findings=[];
  for (const p of policies) {
    if (!p || p.schemaname !== 'public') continue;
    const roles=parseRoles(p.roles);
    if (String(p.permissive).toUpperCase() !== 'PERMISSIVE') continue;
    if (!roles.some(r=>['public','anon','authenticated'].includes(r))) continue;
    const cmd=String(p.cmd||'').toUpperCase();
    const openRead=isUnconditionalTrue(p.qual) && ['ALL','SELECT','UPDATE','DELETE'].includes(cmd);
    const openWrite=isUnconditionalTrue(p.with_check) && ['ALL','INSERT','UPDATE'].includes(cmd);
    if (openRead || openWrite) findings.push({
      table:p.tablename,policy:p.policyname,command:cmd,roles,
      ...(openRead?{unconditional_using:true}:{}),
      ...(openWrite?{unconditional_with_check:true}:{})
    });
  }
  const affected=[...new Set(findings.map(f=>f.table))].sort();
  return {findings,affected,critical:affected.filter(t=>sensitiveTables.includes(t)),safe:findings.length===0};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const file=process.argv[2];
  if (!file) {console.error('Pass path to policy metadata JSON');process.exitCode=2;}
  else {
    try {
      const result=auditPolicies(JSON.parse(readFileSync(file,'utf8')));
      console.log(JSON.stringify(result,null,2));
      if (!result.safe) process.exitCode=1;
    } catch(e) {console.error('Policy metadata audit failed:',e.message);process.exitCode=2;}
  }
}
