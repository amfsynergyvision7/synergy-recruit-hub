/**
 * Nonproduction-only, one-shot hosted GoTrue + 38-row inert fixture runner.
 * Manual GitHub Actions environment must hold the isolated project's secret
 * and nine distinct strong test passwords. NO production credentials, real
 * candidate data, invitations, emails or direct auth.users SQL allowed.
 */
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {planFromEnv,adminConnectionFromEnv,provisionNine,PROJECT_ID,PROJECT_URL,ACK,slotEmail} from './provision-nine-auth-users.mjs';
import {seedInertBaseFixture} from './seed-inert-base-fixture.mjs';
import {seedExtendedFixture,EXPECTED_EXTENDED_COUNTS} from './compose-and-seed-remaining-fixture.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const MANUAL_CONFIRMATION='EXECUTE_9_GO_TRUE_AND_38_INERT_ROWS_ONLY_IN_dhlhlasnaapzckjyvffn';
export const PREFLIGHT_CONFIRMATION='I_REVIEWED_FRESH_NONPROD_SQL_19_EMPTY_ZERO_AUTH_TRIGGERS_GRANTS_POLICIES';
export const OPERATIONS=Object.freeze(['AUDIT_ONLY','CREATE_NINE_AND_SEED_38']);
export const BASE_COUNTS=Object.freeze({profiles:8,user_roles:8,candidates:2});
const TABLES=Object.freeze([...Object.keys(BASE_COUNTS),...Object.keys(EXPECTED_EXTENDED_COUNTS)]);
if(new Set(TABLES).size!==19 ||
   Object.values(BASE_COUNTS).reduce((a,b)=>a+b,0)!==18 ||
   Object.values(EXPECTED_EXTENDED_COUNTS).reduce((a,b)=>a+b,0)!==20) {
  throw new Error('Source-shaped hosted fixture drift');
}
export function executionPlan(env){
 if(env.AMF_UAT_OPERATION!==OPERATIONS[0]&&env.AMF_UAT_OPERATION!==OPERATIONS[1])
   throw new Error('Unknown guarded hosted operation');
 if(env.AMF_UAT_CONFIRMATION!==MANUAL_CONFIRMATION)
   throw new Error('Exact nonproduction manual confirmation required');
 if(env.AMF_UAT_OPERATION===OPERATIONS[1]&&
    env.AMF_UAT_PREFLIGHT_ATTESTATION!==PREFLIGHT_CONFIRMATION)
   throw new Error('Fresh read-only hosted preflight attestation required before synthetic provisioning');
 // Audit mode needs one isolated Admin key, never test-user passwords.
 // Exact source/environment review is unconditional in the GitHub job.
 if(env.AMF_UAT_OPERATION===OPERATIONS[0])
   return {credentials:adminConnectionFromEnv(env),operation:OPERATIONS[0],preflightAttested:false};
 // One 64+ character random master secret deterministically derives nine
 // distinct, strong test passwords, avoiding nine manually configured secrets
 // and allowing future signed UAT to reproduce them without saved plaintext.
 const master=env.AMF_UAT_PASSWORD_MASTER_SECRET;
 if(typeof master!=='string'||!/^amf_uat_master_[A-Za-z0-9_-]{64,}$/.test(master))
   throw new Error('A separate secret-managed high-entropy synthetic password master is required');
 const derived={...env};
 for(let i=1;i<=9;i++){
   const index=String(i).padStart(2,'0');
   const digest=createHmac('sha256',master)
     .update('AMF-NONPROD-GOTRUE-ONLY:'+PROJECT_ID+':slot:'+index)
     .digest('base64url');
   derived['AMF_UAT_CASE_'+index+'_PASSWORD']='Uat9-Aa-'+digest;
 }
 // Reuse independently tested strict project/secret/derived-password guard.
 return {credentials:planFromEnv(derived),operation:env.AMF_UAT_OPERATION,
   preflightAttested:env.AMF_UAT_PREFLIGHT_ATTESTATION===PREFLIGHT_CONFIRMATION};
}
async function countRows(client,table){
 const r=await client.from(table).select('id',{count:'exact',head:true});
 if(r.error||!Number.isSafeInteger(r.count))
   throw new Error('Nonproduction table count is not verifiable');
 return r.count;
}
export async function readHostedSnapshot(client){
 if(typeof client?.auth?.admin?.listUsers!=='function')
   throw new Error('Protected nonproduction Auth Admin client required');
 const auth=await client.auth.admin.listUsers({page:1,perPage:100});
 if(auth.error||!Array.isArray(auth.data?.users)||auth.data.users.length>=100)
   throw new Error('Nonproduction Auth user inventory is not verifiable');
 const users=auth.data.users;
 // Counts alone cannot prove the expected nine synthetic identities.
 const slotsValid=users.length===0 || (users.length===9 &&
   new Set(users.map(u=>u.id)).size===9 &&
   users.every(u=>typeof u.id==='string' &&
     /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(u.id) &&
     (!u.role||u.role==='authenticated')) &&
   Array.from({length:9},(_,i)=>slotEmail(i+1))
     .every(email=>users.filter(u=>u.email===email).length===1));
 const counts={};
 for(const table of TABLES)counts[table]=await countRows(client,table);
 return Object.freeze({authUsers:users.length,tableCounts:counts,
   totalRows:Object.values(counts).reduce((a,b)=>a+b,0),
   syntheticAuthSlotsValid:slotsValid});
}
export function validateSnapshot(snapshot,stage){
 if(!snapshot||!Object.values(snapshot.tableCounts??{}).every(Number.isSafeInteger))
   throw new Error('Unverifiable hosted snapshot');
 if(Object.keys(snapshot.tableCounts??{}).length!==19)
   throw new Error('Unexpected hosted table count');
 const expected=stage==='EMPTY'?{}:stage==='BASE'?BASE_COUNTS:
   stage==='FULL'?{...BASE_COUNTS,...EXPECTED_EXTENDED_COUNTS}:null;
 if(!expected)throw new Error('Invalid snapshot stage');
 const authExpected=stage==='EMPTY'?0:9;
 if(snapshot.authUsers!==authExpected)
   throw new Error('Unexpected number of real nonproduction Auth accounts');
 for(const table of TABLES)if(snapshot.tableCounts[table] !== (expected[table]??0))
   throw new Error('Unexpected table cardinality in hosted synthetic fixture');
 if(snapshot.totalRows!==(stage==='EMPTY'?0:stage==='BASE'?18:38))
   throw new Error('Unexpected overall synthetic row count');
 return true;
}
/**
 * A read-only audit must distinguish an empty isolated lab from the exact
 * completed synthetic fixture. Any partial/mismatched state remains a HOLD,
 * not a successful audit or a cleanup command.
 */
export function validateReadOnlyAudit(snapshot){
 const stage=snapshot?.authUsers===0&&snapshot?.totalRows===0?'EMPTY':
   snapshot?.authUsers===9&&snapshot?.totalRows===38?'FULL':null;
 if(!stage)throw new Error('Nonproduction hosted audit HOLD: partial or unexpected fixture');
 validateSnapshot(snapshot,stage);
 if(stage==='FULL'&&snapshot.syntheticAuthSlotsValid!==true)
   throw new Error('Nonproduction hosted audit HOLD: unexpected Auth identities');
 return stage;
}
export async function runGuardedHostUat(plan,client){
 if(!plan||!OPERATIONS.includes(plan.operation))
   throw new Error('Unknown isolated hosted operation');
 const {operation}=plan;
 if(operation===OPERATIONS[1] && plan.preflightAttested!==true)
   throw new Error('Fresh hosted preflight attestation missing');
 if(operation===OPERATIONS[1] &&
   (plan.credentials?.url!==PROJECT_URL||plan.credentials?.users?.length!==9))
   throw new Error('Invalid exact nonproduction synthetic plan');
 const before=await readHostedSnapshot(client);
 if(operation==='AUDIT_ONLY'){
   const fixtureStage=validateReadOnlyAudit(before);
   return {operation,authUsers:before.authUsers,records:before.totalRows,mutated:false,fixtureStage};
 }
 validateSnapshot(before,'EMPTY');
 let mapping=null;
 // A failure after Auth creation can leave exactly invented users behind.
 // Do not silently retry over partial data or delete unowned IDs.
 await provisionNine(plan.credentials,client.auth.admin,async m=>{mapping=m;});
 if(!mapping)throw new Error('Exact synthetic Auth identity mapping unavailable');
 const base=await seedInertBaseFixture(client,mapping);
 if(base.profiles!==8||base.roles!==8||base.candidates!==2)
   throw new Error('Hosted base fixture integrity mismatch');
 validateSnapshot(await readHostedSnapshot(client),'BASE');
 const ext=await seedExtendedFixture(client,mapping);
 if(ext.insertedRows!==20||ext.populatedExtendedTables!==16)
   throw new Error('Hosted extended fixture integrity mismatch');
 validateSnapshot(await readHostedSnapshot(client),'FULL');
 return {operation,authUsers:9,records:38,mutated:true,formalSignedUat:0};
}
async function main(){
 const plan=executionPlan(process.env);
 if(plan.credentials.url!==PROJECT_URL||process.env.AMF_UAT_PROJECT_ID!==PROJECT_ID||
    process.env.AMF_UAT_ACK!==ACK)
   throw new Error('Dedicated Auth Admin project attestation failed');
 const client=createClient(PROJECT_URL,plan.credentials.key,{
   auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
 });
 const out=await runGuardedHostUat(plan,client);
 process.stdout.write('NONPROD_HOSTED_'+out.operation+
  ': AUTH_USERS='+out.authUsers+', FIXTURE_ROWS='+out.records+
  ', MUTATED='+out.mutated+', FIXTURE_STAGE='+(out.fixtureStage??'NOT_APPLICABLE')+', SIGNED_UAT_ACCEPTED=0\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(()=>{
   process.stderr.write('NONPROD_AUTH_UAT_HOLD_OR_FAILURE: Verify secret binding, exact isolated tenant state and partial-write recovery privately. NO secrets or candidate data logged.\n');
   process.exitCode=1;
 });
}
