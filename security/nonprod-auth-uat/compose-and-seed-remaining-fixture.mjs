/**
 * Build79: complete source-shaped, invented-only 19-table fixture plan.
 * Base 8/8/2 is created by build78 AFTER nine real nonprod GoTrue users exist.
 * This stage inserts exactly 16 additional table groups; all app triggers must
 * remain disabled. No public RLS policy or financial/send/sync activation.
 */
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID,PROJECT_URL,slotEmail,planFromEnv} from './provision-nine-auth-users.mjs';

export const EXECUTE_ACK='I_ACCEPT_SYNTHETIC_16_TABLE_FIXTURE_INERT_NONPROD_ONLY';
export const PRESEED_ACK='TECHNICAL_PRESEED_PREREQUISITES_PASS_NOT_PERMISSION_TO_PROVISION';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const remainingNames=[
 'clients','job_openings','candidate_activities','audit_logs',
 'google_integrations','integrations','candidate_stage_history','submissions',
 'interviews','offers','billing','notifications','sync_logs',
 'app_settings','email_log','workflow_rules'
];
export const EXPECTED_ADMIN_COUNTS=Object.freeze({
 audit_logs:1,billing:1,candidate_activities:1,candidates:2,clients:1,
 google_integrations:1,integrations:1,interviews:2,job_openings:2,
 notifications:2,offers:1,profiles:8,submissions:2,sync_logs:1,user_roles:8
});
export const EXPECTED_EXTENDED_COUNTS=Object.freeze({
 clients:1,job_openings:2,candidate_activities:1,audit_logs:1,
 google_integrations:1,integrations:1,candidate_stage_history:1,submissions:2,
 interviews:2,offers:1,billing:1,notifications:2,sync_logs:1,
 app_settings:1,email_log:1,workflow_rules:1
});

function verifyMapping(mapping){
 const users=mapping?.users;
 if(mapping?.project_id!==PROJECT_ID || !Array.isArray(users) || users.length!==9 ||
   users.some((u,i)=>u.slot!==i+1 || u.email!==slotEmail(i+1) || !uuid.test(u.id)) ||
   new Set(users.map(u=>u.id)).size!==9)
  throw new Error('Build79 needs approved exact nine synthetic GoTrue UUID/email slots');
 return users;
}

export function composeExtendedFixture(mapping, now, generateId=randomUUID){
 const u=verifyMapping(mapping);
 if(typeof now!=='string'||!Number.isFinite(Date.parse(now))||
   typeof generateId!=='function')throw new Error('Invalid time or ID generator');
 const allIds=new Set(u.map(v=>v.id));
 const id=()=>{
   const v=generateId();
   if(typeof v!=='string'||!uuid.test(v)||allIds.has(v))
     throw new Error('Generated fixture UUID invalid or collides with an Auth UUID');
   allIds.add(v);
   return v;
 };
 const [admin,rec1,rec2]=[u[0].id,u[1].id,u[2].id];
 const client=id(),jobs=[id(),id()],subs=[id(),id()],interviews=[id(),id()],offer=id();
 const base={created_at:now};
 const batches=[
 ['clients',[{id:client,company_name:'Fictional UAT Company — NOT A CUSTOMER',
   email:'invented-client@example.invalid',status:'synthetic_inactive',
   created_by:admin,created_at:now,updated_at:now}]],
 ['job_openings',jobs.map((j,i)=>({
   id:j,job_title:`Fictional UAT Job ${i+1}`,client_id:client,client_uuid:client,
   assigned_recruiter:i===0?rec1:rec2,is_confidential:true,status:'draft',
   created_by:admin,created_at:now,updated_at:now,open_positions:0
 }))],
 ['candidate_activities',[{id:id(),candidate_id:rec1,recruiter_id:rec1,
   action_type:'synthetic_noop',notes:'Invented local fixture; no candidate contacted',
   created_at:now}]],
 ['audit_logs',[{id:id(),user_id:admin,
   action:'SYNTHETIC_UAT_NONPROD_NOOP',table_name:'candidates',
   details:{fixture_only:true,no_real_action:true},created_at:now}]],
 ['google_integrations',[{id:id(),user_id:admin,
   sheet_name:'SYNTHETIC_DISCONNECTED',header_row:1,auto_sync_enabled:false,
   sync_frequency_minutes:60,last_synced_row:1,connection_status:'not_configured',
   column_mapping:{},mapping:{},sheet_url:null,spreadsheet_id:null,
   google_account_email:null,created_at:now,updated_at:now}]],
 ['integrations',[{id:id(),module:'synthetic_manual_hold',header_row:1,
   column_mapping:{},auto_sync:false,last_synced_row:1,
   sheet_url:null,spreadsheet_id:null,last_status:'not_configured',
   created_at:now,updated_at:now}]],
 ['candidate_stage_history',[{id:id(),candidate_id:rec1,changed_by:admin,
   previous_stage:null,new_stage:'lead_received',
   notes:'Invented stage unchanged; not a real transition',created_at:now}]],
 ['submissions',subs.map((v,i)=>({
   id:v,candidate_id:i===0?rec1:rec2,candidate_uuid:i===0?rec1:rec2,
   client_id:client,client_uuid:client,job_id:jobs[i],job_uuid:jobs[i],
   role_title:`Fictional UAT Job ${i+1}`,status:'synthetic_hold',
   created_by:admin,created_at:now
 }))],
 ['interviews',interviews.map((v,i)=>({
   id:v,candidate_id:i===0?rec1:rec2,candidate_uuid:i===0?rec1:rec2,
   client_id:client,client_uuid:client,submission_uuid:subs[i],
   status:'not_scheduled',created_by:admin,created_at:now
 }))],
 ['offers',[{id:offer,candidate_id:rec1,candidate_uuid:rec1,client_id:client,
   client_uuid:client,submission_uuid:subs[0],interview_uuid:interviews[0],
   offer_status:'draft',joining_status:'not_joined',
   salary:null,ctc:null,joining_date:null,created_by:admin,
   created_at:now,updated_at:now}]],
 ['billing',[{id:id(),candidate_id:rec1,candidate_uuid:rec1,
   client_id:client,client_uuid:client,offer_uuid:offer,
   invoice_number:null,invoice_date:null,invoice_amount:0,
   placement_fee:0,gst:0,salary:0,outstanding_amount:0,
   payment_status:'synthetic_draft_never_issue',
   created_by:admin,created_at:now,updated_at:now}]],
 ['notifications',[rec1,rec2].map(user_id=>({
   id:id(),user_id,title:'SYNTHETIC UAT — no notification sent',
   message:'Inert database fixture; no delivery',is_read:true,
   type:'synthetic_no_delivery',created_at:now
 }))],
 ['sync_logs',[{id:id(),module:'synthetic_no_connection',
   triggered_by:'synthetic_fixture_no_execution',
   rows_scanned:0,rows_created:0,rows_updated:0,rows_skipped:0,
   errors:[],status:'never_run',message:'No external sync executed',created_at:now}]],
 ['app_settings',[{id:1,updated_at:now,updated_by:null,
   resume_import_folder_url:null,logo_url:null,default_color_theme:'default'}]],
 ['email_log',[{id:id(),related_table:'candidates',related_id:rec1,
   to_email:'never-deliver@example.invalid',
   subject:'SYNTHETIC UAT — not sent',body:'No external send was requested.',
   status:'synthetic_never_sent',provider_id:null,sent_by:null,
   created_at:now}]],
 ['workflow_rules',[{id:id(),name:'SYNTHETIC INACTIVE NOOP',
   table_name:'candidates',field_name:'status',
   field_value:'never_matches_any_candidate',
   action_type:'notify',notify_target:'role:admin',
   notify_title:'Inert',notify_message:'NOT TO BE SENT',
   is_active:false,created_by:admin,created_at:now,updated_at:now}]]
 ];
 if(batches.map(x=>x[0]).join('|')!==remainingNames.join('|'))
   throw new Error('Unexpected source table fixture order');
 for(const [table,rows] of batches){
   if(rows.length!==EXPECTED_EXTENDED_COUNTS[table])
     throw new Error('Source-expected fixture count mismatch: '+table);
   for(const row of rows){
      if(row.id!==1 && (!uuid.test(row.id)||u.some(v=>v.id===row.id)))
         throw new Error('Fixture row ID or test-user collision');
   }
 }
 const asMap=Object.fromEntries(batches);
 if(asMap.workflow_rules[0].is_active!==false ||
    asMap.email_log[0].status==='sent' ||
    asMap.google_integrations[0].auto_sync_enabled!==false ||
    asMap.integrations[0].auto_sync!==false ||
    asMap.sync_logs[0].status==='success' ||
    asMap.billing[0].invoice_number!==null ||
    asMap.offers[0].joining_date!==null)
   throw new Error('A synthetic safety override is missing');
 return Object.freeze({
   batches:batches.map(([table,rows])=>({table,rows})),
   expectedCounts:EXPECTED_EXTENDED_COUNTS,
   historicalAdminCounts:EXPECTED_ADMIN_COUNTS
 });
}

async function exactCount(client,table,expected){
 const r=await client.from(table).select('id',{head:true,count:'exact'});
 if(r.error||r.count!==expected)
   throw new Error(`Build79 refuses unexpected ${table} fixture count`);
}
export async function seedExtendedFixture(client,mapping,opts={}){
 if(typeof client?.from!=='function'||typeof client?.auth?.admin?.listUsers!=='function')
   throw new Error('Build79 requires a protected GoTrue service admin client');
 const users=verifyMapping(mapping);
 const r=await client.auth.admin.listUsers({page:1,perPage:100});
 const allowed=new Map(users.map(u=>[u.id,u.email]));
 if(r.error||r.data?.users?.length!==9 ||
    r.data.users.some(u=>allowed.get(u.id)!==u.email))
    throw new Error('Exact nine synthetic Auth users not verified');
 await exactCount(client,'profiles',8);
 await exactCount(client,'user_roles',8);
 await exactCount(client,'candidates',2);
 const c=await client.from('candidates').select('id,assigned_recruiter');
 if(c.error||!Array.isArray(c.data)||c.data.length!==2||
   !users.slice(1,3).every(u=>c.data.some(v=>v.id===u.id&&v.assigned_recruiter===u.id)))
   throw new Error('Missing exact two recruiter-owned UAT candidate IDs');
 const when=opts.now||new Date().toISOString();
 const plan=composeExtendedFixture(mapping,when,opts.generateId||randomUUID);
 for(const batch of plan.batches)await exactCount(client,batch.table,0);
 const touched=[];
 try {
  for(const {table,rows} of plan.batches){
   touched.push({table,ids:rows.map(r=>r.id)});
   const response=await client.from(table).insert(rows).select('id');
   if(response.error||response.data?.length!==rows.length||
     rows.some(row=>!response.data.some(v=>v.id===row.id)))
    throw new Error('Exact inserted IDs unavailable');
  }
  for(const {table,rows} of plan.batches)
   await exactCount(client,table,rows.length);
  return {insertedRows:plan.batches.reduce((n,b)=>n+b.rows.length,0),
    populatedExtendedTables:16,formalAcceptedCases:0};
 }catch{
  let cleanupUnconfirmed=0;
  for(const {table,ids} of touched.reverse()){
   try{
    const response=await client.from(table).delete().in('id',ids);
    if(response.error)cleanupUnconfirmed++;
   }catch{cleanupUnconfirmed++;}
  }
  throw new Error(`Build79 extended fixture aborted; ${cleanupUnconfirmed} table cleanup results unconfirmed. Inspect isolated lab before retry.`);
 }
}
async function main(){
 const plan=planFromEnv(process.env);
 if(process.env.AMF_UAT_EXTENDED_SEED_MODE!=='EXECUTE'||
   process.env.AMF_UAT_EXTENDED_SEED_ACK!==EXECUTE_ACK||
   process.env.AMF_UAT_PRESEED_READBACK_PASS!==PRESEED_ACK)
   throw new Error('Build79 requires independent isolated preseed review');
 const mapping=JSON.parse(await readFile(plan.mappingFile,'utf8'));
 const {createClient}=await import('@supabase/supabase-js');
 const client=createClient(PROJECT_URL,plan.key,
   {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const out=await seedExtendedFixture(client,mapping);
 process.stdout.write(`BUILD79_SYNTHETIC_EXTENDED_FIXTURE: tables=${out.populatedExtendedTables}; rows=${out.insertedRows}; signed_acceptance=0\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(()=>{
   process.stderr.write('Build79 extended fixture HOLD/FAILED. Check scoped lab and cleanup; no record data or secrets logged.\n');
   process.exitCode=1;
 });
}
