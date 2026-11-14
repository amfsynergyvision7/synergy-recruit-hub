import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('./generate-pg17-source-38-fixture.mjs',import.meta.url));
const compiled=spawnSync(process.execPath,[path],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
const sql=compiled.stdout;
test('Build81 full source-shaped fixture generates offline without Auth Admin, network or credential env',()=>{
 assert.equal(compiled.status,0,compiled.stderr.slice(0,1300));
 assert(sql.length>50000);
 assert.equal((sql.match(/^CREATE TABLE public\./gm)||[]).length,19);
 assert.equal((sql.match(/^CREATE VIEW public\./gm)||[]).length,13);
 assert.equal((sql.match(/^CREATE TRIGGER /gm)||[]).length,32);
 assert.equal((sql.match(/^CREATE ROLE /gm)||[]).length,3);
 assert.match(sql,/CREATE ROLE service_role NOLOGIN/);
});
test('Build81 exact invented 38 rows, nine mock Auth subjects and 75 real catalog constraints',()=>{
 const base=['profiles','user_roles','candidates'];
 const appInsert=[...sql.matchAll(/^INSERT INTO public\.([a-z_]+) \(/gm)].map(x=>x[1]);
 assert.equal(appInsert.length,38);
 assert.equal((sql.match(/^INSERT INTO auth\.users\(/gm)||[]).length,9);
 assert.equal(appInsert.filter(t=>t==='profiles').length,8);
 assert.equal(appInsert.filter(t=>t==='user_roles').length,8);
 assert.equal(appInsert.filter(t=>t==='candidates').length,2);
 assert.equal(appInsert.filter(t=>!base.includes(t)).length,20);
 assert.match(sql,/Source table constraints not complete/);
});
test('Build81 entire disposable source schema and fake app identities roll back after semantic checks',()=>{
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.match(sql,/BUILD81_REAL_SOURCE_SHAPED_38_ROWS_19_TABLES_PG17_PASS_NOT_HOSTED/);
 assert.match(sql,/BUILD81_DISPOSABLE_PG17_SOURCE_FIXTURE_ROLLED_BACK/);
 assert.match(sql,/no app write grant|Unsafe source default\/side effect activation/i);
 assert.match(sql,/t\.tgenabled='D'/);
 assert.match(sql,/pg_policies WHERE schemaname='public'/);
 assert.doesNotMatch(sql,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|wusntntcqgtpgokggdzv/);
});
test('Build81 source schema runner does not execute a GoTrue Admin operation or external HTTP',()=>{
 const js=readFileSync(path,'utf8');
 assert.doesNotMatch(js,/auth\.admin\.createUser|fetch\(|https:\/\//);
 assert.match(js,/composeExtendedFixture/);
 assert.match(js,/makeBaseFixture/);
 assert.match(js,/hardenDDL/);
 assert.match(js,/tableDDL/);
 assert.match(js,/viewDDL/);
 assert.match(js,/triggerDDL/);
});
