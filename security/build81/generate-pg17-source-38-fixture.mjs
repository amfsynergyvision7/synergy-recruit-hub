/**
 * Build81: compile one offline disposable PG17 replay from the real 19/13/32
 * production-shaped nonprod DDL and the exact planned 38 invented fixture rows.
 * NO network, Auth Admin, real Supabase, emails sent, or candidate source data.
 * All DDL and DML are inside one BEGIN..ROLLBACK transaction.
 */
import { readFileSync } from 'node:fs';
import { makeBaseFixture } from '../build78/seed-inert-base-fixture.mjs';
import { composeExtendedFixture } from '../build79/compose-and-seed-remaining-fixture.mjs';
import { PROJECT_ID, slotEmail } from '../build78/provision-nine-auth-users.mjs';
import { buildFullSourceRlsReplay } from './pg17-full-source-135-rls-addon.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const tableDDL = read('../build77/nonprod-public-19-source-shaped-rls-deny.sql');
const viewDDL = read('../build77/nonprod-13-security-invoker-views.sql');
const triggerDDL = read('../build77/nonprod-32-disabled-source-triggers.sql');
const hardenDDL = read('../build78/nonprod-harden-two-definers.sql');
const tabCount = (tableDDL.match(/^CREATE TABLE public\./gm)||[]).length;
const viewCount = (viewDDL.match(/^CREATE VIEW public\./gm)||[]).length;
const triggerCount = (triggerDDL.match(/^CREATE TRIGGER /gm)||[]).length;
if(tabCount!==19 || viewCount!==13 || triggerCount!==32)
 throw new Error('Build81 refuses source schema definition drift');
for(const [tag,s] of [['tables',tableDDL],['views',viewDDL],['triggers',triggerDDL],['hardening',hardenDDL]]){
 if(/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/gmi.test(s))
  throw new Error('Build81 refuses nested transaction in source '+tag);
}
const iso='2026-11-13T00:00:00.000Z';
const u=i=>'0000000'+i+'-1111-4111-8111-00000000000'+i;
const users=Array.from({length:9},(_,i)=>({
 slot:i+1,id:u(i+1),email:slotEmail(i+1)
}));
const map={project_id:PROJECT_ID,users};
let n=0;
const nextId=()=> 'bbbbbbbb-aaaa-4aaa-8aaa-'+String(++n).padStart(12,'0');
const base=makeBaseFixture(map,iso,nextId);
const extended=composeExtendedFixture(map,iso,nextId);
const batches=[
 {table:'profiles',rows:base.profiles},
 {table:'user_roles',rows:base.roles},
 {table:'candidates',rows:base.candidates},
 ...extended.batches
];
if(batches.length!==19 || new Set(batches.map(b=>b.table)).size!==19 ||
 batches.reduce((sum,b)=>sum+b.rows.length,0)!==38 ||
 batches.some(b=>b.rows.length===0))
 throw new Error('Build81 refuses unexpected 38-row invented fixture cardinalities');
function sqlValue(x){
 if(x===null)return 'NULL';
 if(x===undefined)throw new Error('Missing mandatory fixture SQL field');
 if(typeof x==='boolean')return x?'true':'false';
 if(typeof x==='number'&&Number.isFinite(x))return String(x);
 if(typeof x==='string'&&x.length<=4096)return "'"+x.replaceAll("'","''")+"'";
 if(Array.isArray(x)||x&&typeof x==='object')return "'"+JSON.stringify(x).replaceAll("'","''")+"'";
 throw new Error('Non-inert or oversized synthetic SQL source');
}
const insert=(table,r)=>{
 if(!/^[a-z_]+$/.test(table))throw new Error('Invalid SQL identifier');
 const keys=Object.keys(r);
 if(keys.some(k=>!/^[a-z_]+$/.test(k)))throw new Error('Unrecognized fixture SQL column');
 return 'INSERT INTO public.'+table+
  ' ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES ('+
  keys.map(k=>sqlValue(r[k])).join(',')+');';
};
const countRows = batches.map(b =>
 ' SELECT '+sqlValue(b.table)+'::text AS table_name, count(*)::integer AS actual, '+
  String(b.rows.length)+'::integer AS expected FROM public.'+b.table).join('\n UNION ALL\n');
const hasEmail=(b)=>b.rows.some(r=>Object.entries(r).some(([k,v])=>
 (k==='email'||k==='to_email')&&v!=null&& !String(v).endsWith('@example.invalid')));
if(batches.some(hasEmail)||users.some(x=>!x.email.endsWith('@example.invalid')))
 throw new Error('Refusing any non-synthetic email');
const sql=[
'-- Build81 ONE-PASS REAL SOURCE-SHAPED FIXTURE REHEARSAL IN DISPOSABLE PG17 ONLY.',
'-- Contains zero personal/company information, no real credentials, no network calls.',
'BEGIN;',
"SET LOCAL statement_timeout='90s';",
"CREATE ROLE anon NOLOGIN;",
"CREATE ROLE authenticated NOLOGIN;",
"CREATE ROLE service_role NOLOGIN;",
"GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;",
"CREATE SCHEMA auth;",
"CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL);",
"CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $b81$",
"SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;",
"$b81$;",
tableDDL,
viewDDL,
triggerDDL,
hardenDDL,
...users.map(e=> 'INSERT INTO auth.users(id,email) VALUES ('+
 sqlValue(e.id)+','+sqlValue(e.email)+');'),
...batches.flatMap(b=>b.rows.map(row=>insert(b.table,row))),
'WITH counted AS (\n'+countRows+'\n)',
"SELECT table_name,actual,expected FROM counted WHERE actual <> expected;",
'DO $b81_verify$ DECLARE mismatch int; BEGIN',
' WITH counted AS (\n'+countRows+'\n)',
' SELECT count(*) INTO mismatch FROM counted WHERE actual <> expected;',
" IF mismatch<>0 THEN RAISE EXCEPTION 'Build81 real source-shaped fixture cardinality mismatch'; END IF;",
" IF (SELECT count(*) FROM auth.users)<>9 THEN RAISE EXCEPTION 'Nine fake Auth subjects missing'; END IF;",
" IF (SELECT count(*) FROM public.profiles)<>8 OR (SELECT count(*) FROM public.user_roles)<>8",
" OR (SELECT count(*) FROM public.candidates)<>2 THEN RAISE EXCEPTION '8/8/2 identity fixture mismatch'; END IF;",
" IF (SELECT count(*) FROM pg_constraint pc JOIN pg_class c ON c.oid=pc.conrelid",
" WHERE c.relnamespace='public'::regnamespace AND pc.contype IN ('p','u','f','c'))<>75",
" THEN RAISE EXCEPTION 'Source table constraints not complete'; END IF;",
" IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid",
" WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled='D')<>32",
" THEN RAISE EXCEPTION 'Source application trigger not safely disabled'; END IF;",
" IF (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace",
" AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>19",
" THEN RAISE EXCEPTION 'Source RLS + FORCE RLS not enabled'; END IF;",
" IF (SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace",
" AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true']::text[])<>13",
" THEN RAISE EXCEPTION 'Thirteen source-shaped invoker views missing'; END IF;",
" IF (SELECT count(*) FROM pg_policies WHERE schemaname='public')<>0",
" THEN RAISE EXCEPTION 'Source DB unexpectedly has application policies'; END IF;",
" IF EXISTS (SELECT 1 FROM public.workflow_rules WHERE is_active)",
" OR EXISTS (SELECT 1 FROM public.google_integrations WHERE auto_sync_enabled)",
" OR EXISTS (SELECT 1 FROM public.integrations WHERE auto_sync)",
" OR EXISTS (SELECT 1 FROM public.email_log WHERE status='sent')",
" OR EXISTS (SELECT 1 FROM public.sync_logs WHERE status='success')",
" OR EXISTS (SELECT 1 FROM public.billing WHERE invoice_number IS NOT NULL)",
" OR EXISTS (SELECT 1 FROM public.offers WHERE joining_date IS NOT NULL)",
" THEN RAISE EXCEPTION 'Unsafe source default/side effect activation'; END IF;",
" RAISE NOTICE 'BUILD81 SOURCE-SHAPED PG17: 19 tables / 38 invented rows / 75 constraints / 13 invoker views / 32 disabled triggers / 9 fake Auth IDs PASS';",
'END $b81_verify$;',
"SELECT 'BUILD81_REAL_SOURCE_SHAPED_38_ROWS_19_TABLES_PG17_PASS_NOT_HOSTED' AS technical_result,",
" 0::integer AS genuine_gotrue_users_provisioned,",
" 0::integer AS hosted_signed_uat_accepted;",
buildFullSourceRlsReplay(),
'ROLLBACK;',
'DO $b81_clean$ BEGIN',
" IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') OR",
" EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace",
" AND c.relkind IN ('r','v','m')) OR",
" EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))",
" THEN RAISE EXCEPTION 'Build81 disposable source schema or fake role not rolled back'; END IF;",
'END $b81_clean$;',
"SELECT 'BUILD81_DISPOSABLE_PG17_SOURCE_FIXTURE_ROLLED_BACK' AS cleanup_result;",
''].join('\n');
if(sql.includes('SUPABASE_SERVICE_ROLE_KEY')||sql.includes('COPY PROGRAM')||sql.includes('net.http_post'))
 throw new Error('Build81 source fixture may not include privileged keys or egress');
process.stdout.write(sql);
