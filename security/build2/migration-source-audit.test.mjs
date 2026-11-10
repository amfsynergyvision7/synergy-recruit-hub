import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditMigrationDirectory} from './migration-source-audit.mjs';
const repoDir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
test('repository migration inventory is source-only, ordered, fingerprinted and complete',()=>{
 const result=auditMigrationDirectory(repoDir);
 assert.equal(result.status,'STATIC_SOURCE_ONLY_NOT_REPLAYED');
 assert.equal(result.files,26);
 assert.equal(result.inventory.length,26);
 assert.deepEqual(result.inventory.map(x=>x.file),result.inventory.map(x=>x.file).sort());
 for(const row of result.inventory){
  assert.match(row.sha256,/^[a-f0-9]{64}$/);
  assert.ok(row.bytes>0);
 }
 assert.ok(result.inventory.some(x=>x.indicators.security_definer>0));
 assert.ok(result.inventory.some(x=>x.indicators.references_auth));
 assert.ok(result.inventory.some(x=>x.indicators.workflow_financial_terms));
});
test('risk flags are produced without executing any migration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'build2-migrations-'));
 try{
  writeFileSync(join(dir,'20260101000000_fixture.sql'),"CREATE FUNCTION public.x() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'; DROP TABLE public.x; SELECT * FROM auth.users; -- billing\n");
  const r=auditMigrationDirectory(dir);
  assert.equal(r.files,1);
  for(const type of ['definer_privilege_review','destructive_ddl_review','financial_side_effect_review','external_schema_dependency_review'])assert.ok(r.findings.some(x=>x.type===type),type);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
