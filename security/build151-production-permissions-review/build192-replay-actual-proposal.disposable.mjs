/**
 * Build192 disposable PG17 only: run actual source-pinned 67-to-35 draft SQL
 * in an ephemeral local database, withholding its COMMIT and rolling back.
 * NO HOSTED AUTH, SUPABASE SQL, BUSINESS RECORDS OR PRODUCTION WRITES.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const files={
 base:['disposable-rehearsal.DO-NOT-RUN.sql.txt','858542a266e0052124b486610a3eac7266b63ddc'],
 legacy:['legacy-67-policies.DO-NOT-RUN.sql.txt','59ac1f0d25215333868012fdb8e6b9382ed12e14'],
 proposal:['complete-67-to-35-with-rpcs.DO-NOT-APPLY.sql.txt','484c251cdbfd932bdab5ffcf039a107e7478633e'],
 fingerprint:['policy-fingerprint.readonly.sql','6815eebf2fb6fcc70cfc071bd499c98b73bdcc9e'],
 post:['build191-postflight.readonly.sql','7c7185769033b22aeef9fcd5661874ae90329a71']
};
const hash=t=>createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
const read=key=>{
 const [name,sha]=files[key];
 const data=readFileSync(new URL(name,import.meta.url),'utf8');
 assert.equal(hash(data),sha,'Source unexpectedly changed: '+name);
 return data;
};
const base=read('base'),legacy=read('legacy'),proposal=read('proposal'),
 fingerprint=read('fingerprint'),post=read('post');
if(process.env.B192_DISPOSABLE_ONLY!=='true' ||
   process.env.PGHOST!=='127.0.0.1' ||
   process.env.PGDATABASE!=='amf_build192_full_policy_lab')
 throw new Error('Build192 refuses all non-disposable database targets');
const dir=join(process.env.RUNNER_TEMP||'/tmp','build192-disposable');
mkdirSync(dir,{recursive:true});
const p=name=>join(dir,name);
const start='CREATE TYPE public.app_role AS ENUM';
const end='-- Reuse exact live catalog-only preflight';
assert(base.includes(start)&&base.includes(end));
let fixture=base.slice(base.indexOf(start),base.indexOf(end));
assert(fixture.includes('CREATE TABLE public.audit_logs'));
assert(fixture.includes('CREATE VIEW public.vw_submission_filters'));
assert(fixture.includes('ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY'));
assert(!fixture.includes('BEGIN;')&&!fixture.includes('ROLLBACK;'));
fixture=fixture.replaceAll('b73_anon','anon').replaceAll('b73_authenticated','authenticated');
const bootstrap=[
 '-- BUILD192 DISPOSABLE PG17 ONLY. Real draft SQL executes ONLY here.',
 '\\set ON_ERROR_STOP on',
 "DO $guard$ BEGIN IF current_database()<>'amf_build192_full_policy_lab' THEN",
 " RAISE EXCEPTION 'Build192 refuses a non-disposable DB'; END IF; END $guard$;",
 'CREATE ROLE anon NOLOGIN;',
 'CREATE ROLE authenticated NOLOGIN;',
 'CREATE ROLE service_role NOLOGIN;',
 'CREATE SCHEMA auth;',
 "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$ SELECT NULL::uuid $uid$;",
 fixture,
 'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;',
 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;',
 '\\i '+p('old-67-policies.sql')
].join('\n')+'\n';
assert.equal((legacy.match(/^CREATE POLICY /gm)||[]).length,67);
writeFileSync(p('synthetic-source-shaped-bootstrap.sql'),bootstrap);
writeFileSync(p('old-67-policies.sql'),legacy);
assert(fingerprint.trimEnd().endsWith('FROM aggregate;'));
assert(post.trimEnd().endsWith('FROM aggregate;'));
writeFileSync(p('fingerprint.gset.sql'),fingerprint.trimEnd().slice(0,-1)+' \\gset\n');
writeFileSync(p('postflight.gset.sql'),post.trimEnd().slice(0,-1)+' \\gset\n');
const commit='\nCOMMIT;';
const at=proposal.lastIndexOf(commit);
assert(at>0&&proposal.indexOf(commit)===at,'exactly one final COMMIT required');
const after=proposal.slice(at+commit.length);
assert(!/^\s*(?:GRANT|REVOKE|DROP|ALTER|CREATE|DO|COMMIT)\b/m.test(after));
const tail=[
 '-- BUILD192 WITHHOLD original proposal COMMIT for transaction rollback.',
 "\\echo 'BUILD192_SOURCE_PROPOSAL_STATEMENTS_COMPLETE_PENDING_POSTFLIGHT'",
 '\\i '+p('postflight.gset.sql'),
 "SELECT md5(string_agg(tablename||chr(31)||policyname||chr(31)||permissive||chr(31)||roles::text||chr(31)||cmd||chr(31)||coalesce(qual,'<NULL>')||chr(31)||coalesce(with_check,'<NULL>'),chr(10) ORDER BY tablename,policyname)) AS b192_policy_md5 FROM pg_catalog.pg_policies WHERE schemaname='public' \\gset",
 "\\echo 'BUILD192_PROPOSED_35_POLICY_MD5' :b192_policy_md5",
 "SELECT (:'reviewer_gate'='REVIEW_ONLY_PROPOSED_POSTFLIGHT_METADATA_MATCH_NO_RELEASE') AS b192_pass \\gset",
 '\\if :b192_pass',
 " \\echo 'BUILD192_DRAFT_FULL_POSTFLIGHT_REVIEW_ONLY_MATCH'",
 '\\else',
 " \\echo 'BUILD192_DRAFT_POSTFLIGHT_HOLD_DETECTED'",
 ' SELECT 1/0;',
 '\\endif',
 'ROLLBACK;',
 "\\echo 'BUILD192_REAL_DRAFT_TRANSACTION_ROLLED_BACK'",
 '\\i '+p('fingerprint.gset.sql'),
 "SELECT (:'policy_source_gate'='SOURCE_MATCH_REVIEW_ONLY_RELEASE_HOLD') AS b192_back \\gset",
 '\\if :b192_back',
 " \\echo 'BUILD192_ORIGINAL_67_POLICY_CATALOG_RESTORED'",
 '\\else',
 ' SELECT 1/0;',
 '\\endif',
 "SELECT (to_regprocedure('public.crm_admin_manage_user(uuid,text,text)') IS NULL",
 " AND to_regprocedure('public.crm_update_own_profile(text,text,text)') IS NULL) AS b192_rpc_back \\gset",
 '\\if :b192_rpc_back',
 " \\echo 'BUILD192_PROPOSED_ACCOUNT_RPCS_ROLLED_BACK'",
 '\\else',
 ' SELECT 1/0;',
 '\\endif'
].join('\n')+'\n';
writeFileSync(p('real-draft-no-commit.rollback.sql'),proposal.slice(0,at)+'\n'+tail);
console.log('BUILD192_PROPOSAL_GIT_BLOBS_SOURCE_PINNED');
console.log('BUILD192_BOOTSTRAP_PATH '+p('synthetic-source-shaped-bootstrap.sql'));
console.log('BUILD192_FINGERPRINT_PATH '+p('fingerprint.gset.sql'));
console.log('BUILD192_ROLLBACK_DRAFT_PATH '+p('real-draft-no-commit.rollback.sql'));
console.log('BUILD192_REFUSES_HOSTED_AND_DOES_NOT_GENERATE_COMMIT');
