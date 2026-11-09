// Fail-closed release gate. Never connects to a database.
// Use: node security/build2/release-gate.mjs
// A passing offline suite is NOT proof that PostgreSQL RLS is safe.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
const sql=readFileSync(join(dir,'full-rls-replacement-review-only.sql'),'utf8');
const blockers=[
  ['SQL explicitly marked untested',/NOT tested in PostgreSQL/i.test(sql)],
  ['Column-level authorization incomplete',/These controls are not implemented here/i.test(sql)],
  ['Admin workflow not migrated',/Admin profile approval \/ role management workflows must be migrated/i.test(sql)],
  ['Recruiter workflow incompatible',/denies recruiter submission\/interview/i.test(sql)],
  ['View and RPC hardening incomplete',/additional hardening needed for privileged views, functions/i.test(sql)]
];
console.log('BUILD 2 SECURITY RELEASE GATE');
for(const [name,blocked] of blockers) console.log((blocked?'BLOCK':'CHECK')+' | '+name);
console.log('PRODUCTION RELEASE: BLOCKED until isolated database validation and compatibility tests are recorded.');
process.exitCode=1;
