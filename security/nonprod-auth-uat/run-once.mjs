/**
 * Nonproduction-only, one-shot hosted GoTrue + 38-row inert fixture runner.
 * Manual GitHub Actions environment must hold the isolated project's secret
 * and nine distinct strong test passwords. NO production credentials, real
 * candidate data, invitations, emails or direct auth.users SQL allowed.
 */
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {planFromEnv,adminConnectionFromEnv,provisionNine,PROJECT_ID,PROJECT_URL,ACK,slotEmail} from './provision-nine-auth-users.mjs';
import {seedInertBaseFixture,expectedRoles} from './seed-inert-base-fixture.mjs';
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
 // A user replacement during sequential table reads must not be treated
 // as stable synthetic identity evidence. No user attributes are logged.
 const authAfter=await client.auth.admin.listUsers({page:1,perPage:100});
 const afterUsers=authAfter?.data?.users;
 if(authAfter?.error||!Array.isArray(afterUsers)||afterUsers.length!==users.length||
    afterUsers.length>=100||
    users.some(u=>afterUsers.filter(a=>a.id===u.id&&a.email===u.email&&a.role===u.role).length!==1))
   throw new Error('Nonproduction Auth identity inventory changed during snapshot');
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
 if(stage!=='EMPTY' && snapshot.syntheticAuthSlotsValid!==true)
   throw new Error('Unexpected nonproduction Auth identity in staged fixture');
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

/**
 * Build95: count-only "FULL" is NOT evidence that all records remain inert.
 * Inspect only minimal nonproduction columns, never log or return row contents.
 * This performs SELECT and Auth Admin listUsers only: no API mutation.
 */
export async function verifyInertHostedContents(client){
 if(typeof client?.from!=='function'||typeof client?.auth?.admin?.listUsers!=='function')
   throw new Error('Full hosted fixture content verification requires isolated Admin read access');
 const auth=await client.auth.admin.listUsers({page:1,perPage:100});
 const users=auth?.data?.users;
 if(auth.error||!Array.isArray(users)||users.length!==9)
   throw new Error('Hosted inert fixture HOLD: exact synthetic Auth subjects unavailable');
 const getSlot=i=>users.find(u=>u.email===slotEmail(i));
 const ids=Array.from({length:9},(_,i)=>getSlot(i+1)?.id);
 if(ids.some(id=>typeof id!=='string')||new Set(ids).size!==9)
   throw new Error('Hosted inert fixture HOLD: malformed synthetic Auth subject mapping');
 const read=async(table,projection,count)=>{
   const result=await client.from(table).select(projection);
   if(result?.error||!Array.isArray(result?.data)||result.data.length!==count)
     throw new Error('Hosted inert fixture HOLD: expected readback unavailable for '+table);
   return result.data;
 };
 const reject=(table)=>{throw new Error('Hosted inert fixture HOLD: non-inert or mismatched '+table);};
 const profiles=await read('profiles','id,email,status,is_active',8);
 const roles=await read('user_roles','user_id,role',8);
 for(let i=0;i<8;i++){
   const id=ids[i],email=slotEmail(i+1),[role,status,active]=expectedRoles[i];
   if(profiles.filter(p=>p.id===id&&p.email===email&&
     p.status===status&&p.is_active===active).length!==1||
     roles.filter(r=>r.user_id===id&&r.role===role).length!==1)reject('profiles/user_roles');
 }
 if(profiles.some(p=>p.id===ids[8])||roles.some(r=>r.user_id===ids[8]))
   reject('unprofiled negative Auth slot');
 const candidates=await read('candidates','id,assigned_recruiter,email,stage,status,created_source',2);
 for(let i=1;i<=2;i++)
   if(candidates.filter(c=>c.id===ids[i]&&c.assigned_recruiter===ids[i]&&
     c.email==='amf-candidate-'+i+'@example.invalid'&&
     c.stage==='lead_received'&&c.status==='active'&&
     c.created_source==='build78_synthetic_lab').length!==1)
     reject('candidates');

 // Build112: previously unverified action, stage-history and audit rows must
 // contain only their exact known synthetic inert payloads.
 const activities=await read('candidate_activities','candidate_id,recruiter_id,action_type,notes',1);
 if(!activities.every(r=>r.candidate_id===ids[1]&&r.recruiter_id===ids[1]&&
    r.action_type==='synthetic_noop'&&
    r.notes==='Invented local fixture; no candidate contacted'))
   reject('candidate_activities');
 const stageHistory=await read('candidate_stage_history',
   'candidate_id,changed_by,previous_stage,new_stage,notes',1);
 if(!stageHistory.every(r=>r.candidate_id===ids[1]&&r.changed_by===ids[0]&&
    r.previous_stage===null&&r.new_stage==='lead_received'&&
    r.notes==='Invented stage unchanged; not a real transition'))
   reject('candidate_stage_history');
 const auditEvents=await read('audit_logs','user_id,action,table_name,details',1);
 if(!auditEvents.every(r=>r.user_id===ids[0]&&
    r.action==='SYNTHETIC_UAT_NONPROD_NOOP'&&r.table_name==='candidates'&&
    r.details?.fixture_only===true&&r.details?.no_real_action===true&&
    Object.keys(r.details).length===2))
   reject('audit_logs');
 // These are the fixture's security-sensitive activation and egress fields.
 // Exact values are stricter than "not currently active", so a modified lab
 // can never accidentally become an approved source of signed UAT evidence.
 const checks=[
  ['clients','email,status',1,r=>r.email==='invented-client@example.invalid'&&r.status==='synthetic_inactive'],
  ['job_openings','status,is_confidential,open_positions',2,r=>r.status==='draft'&&r.is_confidential===true&&r.open_positions===0],
  ['google_integrations','auto_sync_enabled,connection_status,sheet_url,spreadsheet_id,google_account_email',1,r=>
    r.auto_sync_enabled===false&&r.connection_status==='not_configured'&&r.sheet_url==null&&r.spreadsheet_id==null&&r.google_account_email==null],
  ['integrations','auto_sync,last_status,sheet_url,spreadsheet_id',1,r=>
    r.auto_sync===false&&r.last_status==='not_configured'&&r.sheet_url==null&&r.spreadsheet_id==null],
  ['submissions','status',2,r=>r.status==='synthetic_hold'],
  ['interviews','status',2,r=>r.status==='not_scheduled'],
  ['offers','offer_status,joining_status,joining_date,salary,ctc',1,r=>
    r.offer_status==='draft'&&r.joining_status==='not_joined'&&r.joining_date==null&&r.salary==null&&r.ctc==null],
  ['billing','invoice_number,invoice_date,invoice_amount,placement_fee,gst,salary,outstanding_amount,payment_status',1,r=>
    r.invoice_number==null&&r.invoice_date==null&&r.payment_status==='synthetic_draft_never_issue'&&
    [r.invoice_amount,r.placement_fee,r.gst,r.salary,r.outstanding_amount].every(x=>x===0)],
  ['notifications','type,is_read',2,r=>r.type==='synthetic_no_delivery'&&r.is_read===true],
  ['sync_logs','status,rows_scanned,rows_created,rows_updated,rows_skipped',1,r=>
    r.status==='never_run'&&[r.rows_scanned,r.rows_created,r.rows_updated,r.rows_skipped].every(x=>x===0)],
  ['app_settings','id,default_color_theme,resume_import_folder_url,logo_url',1,r=>
    r.id===1&&r.default_color_theme==='default'&&r.resume_import_folder_url==null&&r.logo_url==null],
  ['email_log','to_email,status,provider_id',1,r=>
    r.to_email==='never-deliver@example.invalid'&&r.status==='synthetic_never_sent'&&r.provider_id==null],
  ['workflow_rules','is_active,field_value',1,r=>
    r.is_active===false&&r.field_value==='never_matches_any_candidate']
 ];
 for(const [table,projection,count,check] of checks){
   const rows=await read(table,projection,count);
   if(!rows.every(check))reject(table);
 }
 return Object.freeze({verifiedNonproductionInertTables:19,contentMutations:0});
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
   if(fixtureStage==='FULL')await verifyInertHostedContents(client);
   // Recheck the final state after content inspection; otherwise a
   // concurrent table-count change could masquerade as a clean audit.
   const after=await readHostedSnapshot(client);
   if(validateReadOnlyAudit(after)!==fixtureStage)
     throw new Error('Nonproduction hosted audit HOLD: fixture changed during inspection');
   return {operation,authUsers:after.authUsers,records:after.totalRows,mutated:false,fixtureStage};
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
 await verifyInertHostedContents(client);
 // Reconfirm identity and counts after inspecting all fixture contents.
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
