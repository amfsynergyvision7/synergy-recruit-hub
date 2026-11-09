// Fail-closed release gate: requires independently recorded evidence.
// Never connects to production and never modifies any database.
// Usage: node security/build2/release-gate.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
let evidence;
try {
  evidence=JSON.parse(readFileSync(join(dir,'release-evidence.json'),'utf8'));
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Expected a release-evidence object');
} catch (cause) {
  console.error('PRODUCTION RELEASE BLOCKED: release evidence is missing or invalid.', cause instanceof Error ? cause.message : '');
  process.exit(1);
}
const checks=[
  'isolated_postgresql_rls_tests_passed',
  'all_19_tables_reviewed',
  'all_13_views_hardened_and_tested',
  'all_16_definer_functions_reviewed',
  'admin_approval_and_role_workflows_tested',
  'recruiter_ownership_and_column_grants_tested',
  'notifications_and_email_log_permissions_tested',
  'rollback_rehearsed',
  'release_approved'
];
let blocked=false;
console.log('BUILD 2 SECURITY RELEASE GATE');
for(const name of checks) {
  const entry=evidence[name];
  const ok=entry?.passed===true && typeof entry.evidence==='string' && entry.evidence.trim().length>0;
  console.log((ok?'PASS':'BLOCK')+' | '+name);
  if(!ok)blocked=true;
}
if(blocked) {
  console.error('PRODUCTION RELEASE BLOCKED: independently verifiable evidence missing.');
  process.exitCode=1;
} else {
  console.log('All evidence fields supplied; manual verification still required before release.');
}
