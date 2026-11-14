/**
 * Build78 — inert base fixture for exact 9/8/8 synthetic UAT identities.
 * Runs only on the dedicated hosted nonproduction project AFTER supported
 * GoTrue Auth Admin has created all nine users; no auth schema SQL writes.
 * Partial fixture only: 8 profiles + 8 roles + 2 invented candidates.
 */
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROJECT_ID,PROJECT_URL,slotEmail,planFromEnv} from './provision-nine-auth-users.mjs';

export const SEED_ACK='I_ACCEPT_INERT_HOSTED_PROFILE_ROLE_CANDIDATE_FIXTURE_ONLY';
export const expectedRoles=[
 ['admin','approved',true],
 ['recruiter','approved',true],
 ['recruiter','approved',true],
 ['finance','approved',true],
 ['operations','approved',true],
 ['recruiter','pending',true],
 ['recruiter','approved',false],
 ['viewer','approved',true]
];
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function makeBaseFixture(mapping,now,generateId=randomUUID){
 if(mapping?.project_id!==PROJECT_ID || !Array.isArray(mapping?.users) ||
    mapping.users.length!==9 || typeof now!=='string' || !Number.isFinite(Date.parse(now)))
   throw new Error('Exact approved synthetic Auth Admin mapping required');
 const users=mapping.users;
 if(users.some((u,i)=>u.slot!==i+1 || !uuid.test(u.id) ||
    u.email!==slotEmail(i+1)) ||
    new Set(users.map(u=>u.id)).size!==9)
   throw new Error('Synthetic Auth subject/email/slot mapping drift');
 const profiles=users.slice(0,8).map((u,i)=>({
   id:u.id,full_name:`Synthetic UAT Profile ${String(i+1).padStart(2,'0')}`,
   email:u.email,status:expectedRoles[i][1],is_active:expectedRoles[i][2],
   created_at:now,updated_at:now
 }));
 const roles=users.slice(0,8).map((u,i)=>({
   id:generateId(),user_id:u.id,role:expectedRoles[i][0],created_at:now
 }));
 const candidates=[1,2].map(i=>({
   // Historical hosted 135-case runner checks exact candidate ID == recruiter Auth ID.
   id:users[i].id,assigned_recruiter:users[i].id,
   full_name:`Invented UAT Candidate ${i}`,
   email:`amf-candidate-${i}@example.invalid`,
   stage:'lead_received',status:'active',created_source:'build78_synthetic_lab',
   created_at:now,updated_at:now
 }));
 if(roles.some(r=>!uuid.test(r.id)) ||
    new Set(roles.map(r=>r.id)).size!==8 ||
    roles.some(r=>users.some(u=>u.id===r.id)))
   throw new Error('Invalid unique synthetic role UUIDs');
 return {profiles,roles,candidates};
}

async function exactEmpty(client,table){
 const res=await client.from(table).select('id',{head:true,count:'exact'});
 if(res.error || res.count!==0)
   throw new Error('Hosted seed aborted: target public table is not verifiably empty');
}
async function exactCount(client,table,n){
 const res=await client.from(table).select('id',{head:true,count:'exact'});
 if(res.error || res.count!==n)
   throw new Error('Hosted seed aborted: unexpected synthetic table row count');
}
export async function seedInertBaseFixture(client,mapping,{now=new Date().toISOString(),generateId=randomUUID}={}){
 if(typeof client?.from!=='function' || typeof client?.auth?.admin?.listUsers!=='function')
   throw new Error('Protected service-role client is required');
 const fixtures=makeBaseFixture(mapping,now,generateId);
 const userList=await client.auth.admin.listUsers({page:1,perPage:100});
 const expected=new Map(mapping.users.map(u=>[u.id,u.email]));
 if(userList.error || !Array.isArray(userList.data?.users) ||
    userList.data.users.length!==9 ||
    userList.data.users.some(u=>!expected.has(u.id)||expected.get(u.id)!==u.email))
   throw new Error('Abort: exact nine nonproduction GoTrue users not verified');
 for(const t of ['profiles','user_roles','candidates'])await exactEmpty(client,t);
 // Record intended IDs before each call: a timed-out successful POST is still
 // eligible for id-scoped compensation if the client never received its result.
 const attempts=[];
 const jobs=[
   ['profiles',fixtures.profiles],
   ['user_roles',fixtures.roles],
   ['candidates',fixtures.candidates]
 ];
 try{
   for(const [table,rows] of jobs){
     attempts.push([table,rows.map(r=>r.id)]);
     const result=await client.from(table).insert(rows).select('id');
     const got=result?.data;
     if(result?.error || !Array.isArray(got) || got.length!==rows.length ||
       new Set(got.map(v=>v.id)).size!==rows.length ||
       rows.some(r=>!got.some(v=>v.id===r.id)))
       throw new Error('Exact synthetic insert acknowledgement missing');
   }
   await exactCount(client,'profiles',8);
   await exactCount(client,'user_roles',8);
   await exactCount(client,'candidates',2);
   // Spot-check no ninth profile or role and actual role/status/active combinations
   // using ID/flags only; responses are never logged or exported.
   const pr=await client.from('profiles').select('id,status,is_active');
   const ur=await client.from('user_roles').select('user_id,role');
   if(pr.error||ur.error||pr.data?.length!==8||ur.data?.length!==8)
     throw new Error('Synthetic profile/role integrity readback failed');
   for(let i=0;i<8;i++){
     const id=mapping.users[i].id;
     if(!pr.data.some(p=>p.id===id && p.status===expectedRoles[i][1] &&
        p.is_active===expectedRoles[i][2]) ||
        !ur.data.some(r=>r.user_id===id && r.role===expectedRoles[i][0]))
       throw new Error('Synthetic role or activity state mismatch');
   }
   if(pr.data.some(p=>p.id===mapping.users[8].id) ||
      ur.data.some(r=>r.user_id===mapping.users[8].id))
     throw new Error('Negative slot 9 is not unprofiled/unroled');
   return Object.freeze({profiles:8,roles:8,candidates:2,formal_uat_accepted:0});
 }catch{
   let cleanupUnconfirmed=0;
   for(const [table,ids] of attempts.reverse()){
     try{
       // Verify exact returned deleted IDs: an RLS-silent HTTP success with
       // zero affected rows cannot be treated as confirmed compensation.
       const out=await client.from(table).delete().in('id',ids).select('id');
       const removed=out?.data;
       if(out?.error || !Array.isArray(removed) ||
          removed.length!==ids.length ||
          new Set(removed.map(r=>r.id)).size!==ids.length ||
          ids.some(id=>!removed.some(r=>r.id===id)))
         cleanupUnconfirmed++;
     }catch{cleanupUnconfirmed++;}
   }
   throw new Error(`Hosted inert fixture aborted; ${cleanupUnconfirmed} cleanup calls unconfirmed. Verify lab before retrying.`);
 }
}
async function main(){
 const plan=planFromEnv(process.env);
 if(process.env.AMF_UAT_SEED_MODE!=='EXECUTE' ||
    process.env.AMF_UAT_SEED_ACK!==SEED_ACK)
   throw new Error('Separate synthetic-only seed acknowledgement required');
 const mapping=JSON.parse(await readFile(plan.mappingFile,'utf8'));
 const {createClient}=await import('@supabase/supabase-js');
 const client=createClient(PROJECT_URL,plan.key,{
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
 });
 const out=await seedInertBaseFixture(client,mapping);
 process.stdout.write(`INERT_BASE_FIXTURE_PASS: profiles=${out.profiles}, roles=${out.roles}, candidates=${out.candidates}, accepted_uat=0\n`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main().catch(()=>{
   process.stderr.write('Build78 inert base fixture HOLD/FAILED. Inspect protected lab and cleanup; no account details logged.\n');
   process.exitCode=1;
 });
}
