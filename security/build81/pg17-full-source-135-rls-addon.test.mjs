import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFullSourceRlsReplay} from './pg17-full-source-135-rls-addon.mjs';
import {readFileSync} from 'node:fs';
const sql=buildFullSourceRlsReplay();
const matrix=JSON.parse(readFileSync(new URL('../build41/signed-http-135-read-matrix.json',import.meta.url),'utf8'));
const tuples=[...sql.matchAll(/^\s*\((\d+),'([a-z_]+)',(\d+)\),?$/gm)];

test('Build81 full source RLS replay uses 15 exact Build80 policy definitions',()=>{
 const original=readFileSync(new URL('../build80/15-surface-135-read-review-only.rollback.sql',import.meta.url),'utf8');
 const i=original.indexOf('CREATE SCHEMA amf_rls_guard;');
 const e=original.lastIndexOf('ROLLBACK;');
 assert(i>0 && e>i);
 assert(sql.includes(original.slice(i,e).trim()));
 assert.equal((sql.match(/^CREATE POLICY b80_read_/gm)||[]).length,15);
 assert.equal((sql.match(/^GRANT SELECT ON /gm)||[]).length,1);
 assert.doesNotMatch(sql,/^\s*GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE)/gmi);
});
test('exact 135 historic case tuple source, order, expected counts and identities',()=>{
 assert.equal(tuples.length,135);
 for(let i=0;i<135;i++){
  assert.equal(Number(tuples[i][1]),Math.floor(i/15)+1);
  assert.equal(tuples[i][2],matrix.read_cases[i].table);
  assert.equal(Number(tuples[i][3]),matrix.read_cases[i].expected);
 }
 assert.match(sql,/IF tested<>135/);
});
test('full source RLS checks reject anon, cross-owner, direct writes and unprofiled records',()=>{
 assert.match(sql,/SET LOCAL ROLE authenticated/);
 assert.match(sql,/SET LOCAL ROLE anon/);
 assert.match(sql,/IF blocked<>4/);
 assert.match(sql,/IF blocked<>6/);
 assert.match(sql,/Full source unexpected app write grants/);
 assert.match(sql,/Recruiter row ownership violated/);
 assert.match(sql,/Empty subject revealed profile/);
 assert.match(sql,/0::integer AS genuine_signed_hosted_sessions/);
});
test('no nested transaction or actual credentials in the compiled RLS add-on',()=>{
 assert.doesNotMatch(sql,/^BEGIN;$|^ROLLBACK;$/gm);
 assert.doesNotMatch(sql,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|wusntntcqgtpgokggdzv/);
 assert.equal((sql.match(/amf_rls_guard\.current_has_role\(/g)||[]).length>1,true);
});
