import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// REVIEW-ONLY: no database driver, network access, or SQL execution.
const dir=dirname(fileURLToPath(import.meta.url));
const load=name=>readFileSync(resolve(dir,name),'utf8');
const manifest=JSON.parse(load('source-manifest.json'));
const inventory=JSON.parse(load('baseline-48.json'));
const preflight=load('production-preflight.readonly.sql');
const draft=load('lockdown.DO-NOT-APPLY.review.sql');
const rehearsal=load('disposable-rehearsal.DO-NOT-RUN.sql.txt');
const blobSha=text=>createHash('sha1')
  .update('blob '+Buffer.byteLength(text,'utf8')+'\0').update(text,'utf8')
  .digest('hex');
const between=(s,start,end)=>{
  const from=s.indexOf(start);
  assert(from>=0,'Missing expected SQL start '+start);
  const to=s.indexOf(end,from+start.length);
  assert(to>from,'Missing expected SQL end '+end);
  return s.slice(from+start.length,to);
};
const sqlValueNames=part=>[...part.matchAll(/\('([^']+)'\)/g)].map(m=>m[1]);

test('Build151 four reviewed files match exact Git blob SHAs from PR12, no substitutions',()=>{
 assert.equal(manifest.source_pr,12);
 assert.match(manifest.source_pr_head,/^[0-9a-f]{40}$/);
 assert.equal(manifest.original_sources.length,4);
 assert.equal(new Set(manifest.original_sources.map(x=>x.review_copy)).size,4);
 for(const source of manifest.original_sources){
  const local=source.review_copy.split('/').at(-1);
  assert.equal(source.review_copy,'security/build151-production-permissions-review/'+local);
  assert.match(source.source_path,/^security\/build(?:47|73)\//);
  assert.equal(blobSha(load(local)),source.source_blob_sha,'Source drift: '+local);
 }
});
test('Build151 preflight enumerates exact approved 19 tables, 13 views and 16 function signatures',()=>{
 assert.deepEqual(
  sqlValueNames(between(preflight,"WITH expected_tables(name) AS (VALUES", "), expected_views(name) AS (VALUES")),
  inventory.objects.tables
 );
 assert.deepEqual(
  sqlValueNames(between(preflight,"), expected_views(name) AS (VALUES", "), expected_functions(signature) AS (VALUES")),
  inventory.objects.views
 );
 const f=sqlValueNames(between(preflight,"), expected_functions(signature) AS (VALUES", "), tab AS ("));
 assert.equal(f.length,16);
 assert.equal(new Set(f).size,16);
 assert.deepEqual(f.map(x=>x.replace(/^public\./,'').replace(/public\.app_role/g,'app_role').split('(')[0]),
  inventory.objects.functions);
 assert.deepEqual(
  [inventory.objects.tables.length,inventory.objects.views.length,inventory.objects.functions.length],
  [19,13,16]
 );
 assert.equal(manifest.expected_catalog.security_objects,48);
});
test('Build151 diagnostic is single SELECT and cannot mutate a hosted DB',()=>{
 assert.match(preflight,/^-- Build73 READ-ONLY catalog-only 48-object permission preflight/);
 assert.match(preflight,/^WITH expected_tables\(name\) AS \(VALUES/m);
 assert.match(preflight,/FROM aggregate;\s*$/);
 assert.equal((preflight.match(/;/g)||[]).length,1);
 assert.doesNotMatch(preflight,/(?:^|;)\s*(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE|REVOKE|GRANT|ALTER|CALL|DO|COPY|EXECUTE|COMMIT|BEGIN)\b/im);
 assert.doesNotMatch(preflight,/\bSELECT\s+\*\s+FROM\s+(?:public|auth)\./i);
});
test('Build151 prospective production changes remain a DRAFT, never a managed migration',()=>{
 assert.match(draft,/REVIEW-ONLY: 48-object anonymous privilege lockdown/);
 assert.match(draft,/DO NOT RUN in production\/staging/);
 assert.match(draft,/\bBEGIN;/);
 assert.match(draft,/\bCOMMIT;/);
 assert.match(draft,/REVOKE\s/i);
 assert.match(draft,/ALTER VIEW/i);
 assert.match(draft,/DROP POLICY/i);
 for(const n of [19,13,16])assert(draft.includes('IF n<>'+n),'Missing preflight object guard '+n);
 assert.equal(manifest.acceptance.approved_for_execution,false);
 assert.equal(manifest.acceptance.production_remediations_applied,0);
 assert.equal(manifest.acceptance.independently_accepted,0);
 assert.equal(manifest.acceptance.total,48);
});
test('Build151 disposable rehearsal must refuse any database except exact lab and ROLLBACK',()=>{
 assert.match(rehearsal,/current_database\(\)<>'amf_build73_permissions_lab'/);
 assert.match(rehearsal,/BEGIN;/);
 assert.match(rehearsal,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(rehearsal,/(^|\n)COMMIT;\s*(\n|$)/);
 assert.match(rehearsal,/DISPOSABLE PostgreSQL 17 ONLY/);
});
test('Build151 live-readonly baseline is correctly marked HOLD, not accepted',()=>{
 const x=manifest.live_readonly_observation_2026_11_15;
 assert.equal(x.project_ref,'wusntntcqgtpgokggdzv');
 assert.equal(x.permission_preflight,'HOLD_48_OBJECT_PERMISSIONS_NOT_SAFE_OR_SCOPE_DRIFT');
 assert.equal(x.matched_tables,19);
 assert.equal(x.anon_truncate_tables,19);
 assert.equal(x.authenticated_truncate_tables,19);
 assert.equal(x.security_invoker_views,0);
 assert.equal(x.anon_readable_views,13);
 assert.equal(x.anon_executable_privileged_functions,16);
 assert.equal(x.public_executable_privileged_functions,9);
 assert.equal(x.rows_queried,0);
 assert.equal(x.writes,0);
});
test('Build151 independently reviewable package cannot be misconstrued as release approval',()=>{
 const readme=load('README.md');
 assert.match(readme,/DO NOT EXECUTE|DO NOT APPLY/);
 assert.match(readme,/0\/48/);
 assert.match(readme,/independent/i);
 assert.match(readme,/RLS|polic/i);
 assert.match(readme,/PITR|restore/i);
 assert.match(readme,/not.*production deploy/i);
 assert(!manifest.original_sources.some(x=>x.review_copy.startsWith('supabase/migrations/')));
});
