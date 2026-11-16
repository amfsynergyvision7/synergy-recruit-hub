/** Build195 CI throwaway PG17 only. Source-pinned actual draft SQL, not hosted. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='security/build151-production-permissions-review/';
const specs={
 auth:['build195-gotrue-auth-base.disposable.sql','27058f2f2c3f91552686a02cea3e9110132bb0cd'],
 helper:['build194-role-helper.PR23-SNAPSHOT.DO-NOT-APPLY.sql.txt','309b62681dd6ce221f24733766aa9b48da845c8f'],
 proposal:['complete-67-to-35-with-rpcs.DO-NOT-APPLY.sql.txt','484c251cdbfd932bdab5ffcf039a107e7478633e'],
 old:['legacy-67-policies.DO-NOT-RUN.sql.txt','59ac1f0d25215333868012fdb8e6b9382ed12e14'],
 base:['disposable-rehearsal.DO-NOT-RUN.sql.txt','858542a266e0052124b486610a3eac7266b63ddc'],
 prodApproval:['build197-prod-is-approved.snapshot.DISPOSABLE-ONLY.sql.txt','5e8f3f758b2f551111e883141a728a0b82e38373']
};
function read(key){
 const [path,expected]=specs[key],body=readFileSync(new URL(path,import.meta.url),'utf8');
 const sha=createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0').update(body).digest('hex');
 assert.equal(sha,expected,'source drift '+key);return body;
}
for(const k of Object.keys(specs))read(k);
assert(process.env.B195_DISPOSABLE_ONLY==='true'&&
 process.env.PGHOST==='127.0.0.1'&&
 process.env.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&
 process.env.PGUSER==='postgres'&&process.env.B195_JWT_SECRET?.length>=32,
 'Build195 non-disposable execution refused');
const base=read('base'),from='CREATE TYPE public.app_role AS ENUM';
const body=base.slice(base.indexOf(from),base.indexOf('-- Reuse exact live catalog-only preflight'))
 .replaceAll('b73_anon','anon').replaceAll('b73_authenticated','authenticated');
assert(body.startsWith(from)&&body.includes('CREATE TABLE public.candidates')&&
 body.includes('CREATE VIEW public.vw_submission_filters'));
assert(!/^\s*(?:BEGIN|COMMIT|ROLLBACK);/m.test(body));
const old=read('old'),draft=read('proposal');
assert.equal((old.match(/^CREATE POLICY /gm)||[]).length,67);
const committedAt=draft.lastIndexOf('\nCOMMIT;');
assert(committedAt>0&&draft.indexOf('\nCOMMIT;')===committedAt,'One original proposal COMMIT is required');
assert(!/^\\s*(?:GRANT|REVOKE|DROP|ALTER|CREATE|DO|COMMIT)\\b/m.test(draft.slice(committedAt+'\nCOMMIT;'.length)),'Executable SQL after original COMMIT is forbidden');
assert(read('helper').includes('_user_id IS NOT NULL'));
const dir=join(process.env.RUNNER_TEMP||'/tmp','build195-ephemeral');
mkdirSync(dir,{recursive:true});
const p=n=>join(dir,n),guard=[
 'DO $b195_guard$','BEGIN',
 " IF current_database()<>'amf_build195_gotrue_35_policy_lab' OR session_user<>'postgres'",
 " THEN RAISE EXCEPTION 'Build195 non-disposable database refused'; END IF;",
 'END $b195_guard$;'
].join('\n');
writeFileSync(p('old-67.sql'),old);
const boot=[
 '-- CI-only locally pinned source-shaped fixture.',
 '\\set ON_ERROR_STOP on',guard,
 "CREATE ROLE authenticator LOGIN PASSWORD 'build195_local_authenticator_only_7s9q';",
 'GRANT anon,authenticated,service_role TO authenticator;',
 'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,authenticator;',
 "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''",
 "AS $uid$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),",
 "nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $uid$;",
 'GRANT USAGE ON SCHEMA auth TO authenticated;',
 'GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;',
 body,
 'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;',
 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;',
 '\\i '+p('old-67.sql')
].join('\n')+'\n';
writeFileSync(p('source-shaped-bootstrap.sql'),boot);
// Build197: same SQL definition as current production is_approved, read-only
// catalog-sourced and fingerprint checked; executed only in disposable PG17.
const after=[
 '-- Commits ONLY to ephemeral PG17, destroyed by CI.',
 '\\set ON_ERROR_STOP on',guard,
 '\\i '+root+specs.proposal[0],
 '\\i '+root+specs.helper[0],
 '\\i '+root+specs.prodApproval[0],
 "DO $meta$ BEGIN IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='public')<>35",
 " OR NOT (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.has_role(uuid,public.app_role)'))",
 " OR pg_catalog.has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE')",
 " OR (SELECT coalesce(array_to_string(proconfig,','),'') FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.is_approved(uuid)'))<>'search_path=public'",
 " THEN RAISE EXCEPTION 'Build195 proposed source metadata mismatched'; END IF;",
 " RAISE NOTICE 'BUILD195_ONLY_DISPOSABLE_35_POLICIES_COMMITTED'; END $meta$;"
].join('\n')+'\n';
writeFileSync(p('install-only-in-ephemeral-db.sql'),after);
console.log('BUILD195_SOURCE_BLOBS_PINNED '+JSON.stringify(Object.fromEntries(Object.entries(specs).map(([k,x])=>[k,x[1]]))));
console.log('BUILD195_GENERATED_DISPOSABLE_FIXTURE '+p('source-shaped-bootstrap.sql'));
console.log('BUILD195_GENERATED_DRAFT_INSTALL '+p('install-only-in-ephemeral-db.sql'));
