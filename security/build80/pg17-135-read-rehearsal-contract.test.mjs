import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {READ_TABLES,PRIVATE_DENY_TABLES} from './role-read-oracle.mjs';

const original=readFileSync(new URL('15-surface-135-read-review-only.rollback.sql',import.meta.url),'utf8');
const pg=readFileSync(new URL('pg17-135-read-rehearsal.rollback.sql',import.meta.url),'utf8');
const core=original.slice(original.indexOf('CREATE SCHEMA amf_rls_guard;'),
 original.indexOf('ROLLBACK;'));
const cases=[...pg.matchAll(/^\s*\((\d+),'([a-z_]+)',(\d+)\),?$/gm)];

test('actual PostgreSQL rehearsal reuses exact role helper and review-only policy SQL source',()=>{
 assert(core.startsWith('CREATE SCHEMA amf_rls_guard;'));
 assert(pg.includes(core.trimEnd()));
 assert.equal((pg.match(/^CREATE POLICY b80_read_/gm)||[]).length,15);
 assert.equal((pg.match(/^CREATE TABLE public\./gm)||[]).length,19);
 assert.deepEqual(new Set(READ_TABLES.concat(PRIVATE_DENY_TABLES)).size,19);
 assert.equal((pg.match(/^ROLLBACK;/gm)||[]).length,1);
});

test('disposable PostgreSQL matrix has exact 135 source-shaped historical case values',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../build41/signed-http-135-read-matrix.json',import.meta.url),'utf8'));
 assert.equal(cases.length,135);
 for(let i=0;i<135;i++){
  assert.equal(Number(cases[i][1]),Math.floor(i/15)+1);
  assert.equal(cases[i][2],frozen.read_cases[i].table);
  assert.equal(Number(cases[i][3]),frozen.read_cases[i].expected);
 }
});

test('real database role and owner isolation assertions execute before unconditional rollback',()=>{
 assert.match(pg,/CREATE ROLE anon NOLOGIN/);
 assert.match(pg,/CREATE ROLE authenticated NOLOGIN/);
 assert.match(pg,/CREATE FUNCTION auth\.uid\(\)/);
 assert.match(pg,/SET LOCAL ROLE authenticated/);
 assert.match(pg,/SET LOCAL ROLE anon/);
 assert.match(pg,/FOR c IN SELECT \* FROM \(VALUES/);
 assert.match(pg,/IF tested<>135/);
 assert.match(pg,/IF denied<>4/);
 assert.match(pg,/IF blocked<>6/);
 assert.match(pg,/Recruiter 2 reads another recruiter candidate/);
 assert.match(pg,/Accidental signed-user write grant/);
 assert.match(pg,/BUILD80_POSTGRES17_ALL_SYNTHETIC_SCHEMA_AND_ROLES_ROLLED_BACK/);
});

test('no real auth users, session tokens, production projects or network are involved',()=>{
 assert.doesNotMatch(pg,/INSERT INTO auth\.users/i);
 assert.doesNotMatch(pg,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|https:\/\//i);
 assert.doesNotMatch(pg,/\\connect|\\copy|COPY\s+.*PROGRAM/i);
 assert.match(pg,/0 AS hosted_signed_gotrue_cases,0 AS formal_uat_accepted/);
});
