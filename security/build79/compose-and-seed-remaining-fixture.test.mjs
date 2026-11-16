import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_ID,slotEmail} from '../build78/provision-nine-auth-users.mjs';
import {makeBaseFixture} from '../build78/seed-inert-base-fixture.mjs';
import {composeExtendedFixture,seedExtendedFixture,EXPECTED_EXTENDED_COUNTS,EXPECTED_ADMIN_COUNTS}
  from './compose-and-seed-remaining-fixture.mjs';

const accountId=i=>`0000000${i}-1111-4111-8111-00000000000${i}`;
const rowId=i=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12,'0')}`;
const mapping=()=>({project_id:PROJECT_ID,users:Array.from({length:9},(_,i)=>({
 slot:i+1,id:accountId(i+1),email:slotEmail(i+1)
}))});
const generator=()=>{let c=0;return ()=>rowId(++c);};
const at='2026-11-13T00:00:00.000Z';

function fixtureLab({failTable=null,corruptBase=false,existingAuth=null}={}){
 const source=makeBaseFixture(mapping(),at,generator());
 const tables={profiles:source.profiles,user_roles:source.roles,candidates:source.candidates};
 if(corruptBase)tables.candidates[0].assigned_recruiter=accountId(4);
 const inserted=[],deleted=[];
 const lab={
  auth:{admin:{listUsers:async()=>({error:null,data:{users:
   existingAuth??mapping().users.map(u=>({id:u.id,email:u.email}))}})}},
  from(table){
   if(!(table in tables))tables[table]=[];
   return {
    select(cols,opts={}){
     if(opts.head)return Promise.resolve({count:tables[table].length,error:null});
     const k=cols.split(',');
     return Promise.resolve({data:tables[table].map(v=>Object.fromEntries(k.map(col=>[col,v[col]]))),error:null});
    },
    insert(rows){
     inserted.push(table);
     tables[table].push(...rows);
     return {select:async()=>({
       data:table===failTable?null:rows.map(v=>({id:v.id})),
       error:table===failTable?{message:'mock provider acknowledgement unavailable'}:null
     })};
    },
    delete(){
     return {in:async(col,ids)=>{
       assert.equal(col,'id');
       deleted.push(table);
       tables[table]=tables[table].filter(v=>!ids.includes(v.id));
       return {error:null};
     }};
    }
   };
  }
 };
 return {lab,tables,inserted,deleted};
}

test('pure source-shaped plan populates all remaining 16 tables and matches 15 historical admin counts',()=>{
 const p=composeExtendedFixture(mapping(),at,generator());
 const all=new Map(p.batches.map(b=>[b.table,b.rows]));
 assert.equal(p.batches.length,16);
 assert.equal(all.size,16);
 assert.deepEqual(new Set(Object.keys(EXPECTED_EXTENDED_COUNTS)),new Set(all.keys()));
 const base=makeBaseFixture(mapping(),at,generator());
 const administered={...Object.fromEntries(p.batches.map(b=>[b.table,b.rows.length])),
   profiles:base.profiles.length,user_roles:base.roles.length,candidates:base.candidates.length};
 for(const [t,n] of Object.entries(EXPECTED_ADMIN_COUNTS))
   assert.equal(administered[t],n,'historical admin expected '+t);
 assert.equal(Object.keys(administered).length,19);
 const total=Object.values(administered).reduce((a,b)=>a+b,0);
 assert(total>=35);
 for(const rows of all.values())assert(rows.length>0);
});

test('all cross-table references come from the permitted invented identity graph',()=>{
 const p=composeExtendedFixture(mapping(),at,generator());
 const a=Object.fromEntries(p.batches.map(b=>[b.table,b.rows]));
 assert.equal(a.job_openings.length,2);
 assert.equal(a.submissions.length,2);
 assert.equal(a.interviews.length,2);
 assert.equal(a.notifications.length,2);
 const client=a.clients[0].id;
 for(let i=0;i<2;i++){
  assert.equal(a.job_openings[i].client_id,client);
  assert.equal(a.job_openings[i].assigned_recruiter,accountId(i+2));
  assert.equal(a.submissions[i].job_id,a.job_openings[i].id);
  assert.equal(a.submissions[i].candidate_id,accountId(i+2));
  assert.equal(a.interviews[i].candidate_id,accountId(i+2));
  assert.equal(a.interviews[i].submission_uuid,a.submissions[i].id);
  assert.equal(a.notifications[i].user_id,accountId(i+2));
 }
 assert.equal(a.offers[0].interview_uuid,a.interviews[0].id);
 assert.equal(a.billing[0].offer_uuid,a.offers[0].id);
 assert.equal(a.candidate_stage_history[0].changed_by,accountId(1));
 assert.equal(a.email_log[0].related_id,accountId(2));
});

test('finance, email, sheets, sync, workflow and candidate stages are explicitly inert',()=>{
 const {batches}=composeExtendedFixture(mapping(),at,generator());
 const p=Object.fromEntries(batches.map(b=>[b.table,b.rows]));
 assert.equal(p.billing[0].invoice_number,null);
 assert.equal(p.billing[0].invoice_date,null);
 assert.equal(p.billing[0].invoice_amount,0);
 assert.equal(p.billing[0].payment_status,'synthetic_draft_never_issue');
 assert.equal(p.offers[0].joining_date,null);
 assert.equal(p.offers[0].offer_status,'draft');
 assert.equal(p.offers[0].joining_status,'not_joined');
 assert.equal(p.email_log[0].status,'synthetic_never_sent');
 assert(p.email_log[0].to_email.endsWith('@example.invalid'));
 assert.equal(p.google_integrations[0].auto_sync_enabled,false);
 assert.equal(p.google_integrations[0].sheet_url,null);
 assert.equal(p.google_integrations[0].spreadsheet_id,null);
 assert.equal(p.google_integrations[0].last_synced_row,1);
 assert.equal(p.integrations[0].auto_sync,false);
 assert.equal(p.sync_logs[0].status,'never_run');
 assert.equal(p.workflow_rules[0].is_active,false);
 assert.equal(p.workflow_rules[0].action_type,'notify');
 assert.equal(p.workflow_rules[0].notify_target,'role:admin');
 assert.equal(p.app_settings[0].id,1);
 assert.equal(p.app_settings[0].resume_import_folder_url,null);
 assert(!JSON.stringify(p).includes('https://'));
});

test('mapping tamper and duplicate fixture-generated UUIDs are rejected before any writes',()=>{
 for(const change of [
   m=>m.project_id='wusntntcqgtpgokggdzv',
   m=>m.users[8].id=m.users[0].id,
   m=>m.users[0].email='actual@company.com',
   m=>m.users.pop()
 ]){const x=mapping();change(x);assert.throws(()=>composeExtendedFixture(x,at,generator()));}
 assert.throws(()=>composeExtendedFixture(mapping(),at,()=>accountId(1)));
 assert.throws(()=>composeExtendedFixture(mapping(),at,()=>rowId(1)));
});

test('server-side service-role session requires exactly 9 invented GoTrue accounts',async()=>{
 const f=fixtureLab({existingAuth:[]});
 await assert.rejects(seedExtendedFixture(f.lab,mapping(),{now:at,generateId:generator()}));
 assert.deepEqual(f.inserted,[]);
});

test('base preseed must have exactly two real recruiter-owned subject IDs',async()=>{
 const f=fixtureLab({corruptBase:true});
 await assert.rejects(seedExtendedFixture(f.lab,mapping(),{now:at,generateId:generator()}),
  /exact two recruiter-owned/);
 assert.deepEqual(f.inserted,[]);
});

test('successful mock seeding touches exactly 16 additional public table groups',async()=>{
 const f=fixtureLab();
 const s=await seedExtendedFixture(f.lab,mapping(),{now:at,generateId:generator()});
 assert.equal(s.populatedExtendedTables,16);
 assert.equal(s.formalAcceptedCases,0);
 assert.equal(f.inserted.length,16);
 assert.equal(f.tables.profiles.length,8);
 assert.equal(f.tables.user_roles.length,8);
 assert.equal(f.tables.candidates.length,2);
 for(const [t,n] of Object.entries(EXPECTED_EXTENDED_COUNTS))
  assert.equal(f.tables[t].length,n,t);
 assert.equal(s.insertedRows,Object.values(EXPECTED_EXTENDED_COUNTS).reduce((a,b)=>a+b,0));
});

test('mid-seed error attempts reverse scoped cleanup without deleting 8/8/2 base rows',async()=>{
 const f=fixtureLab({failTable:'interviews'});
 await assert.rejects(seedExtendedFixture(f.lab,mapping(),{now:at,generateId:generator()}),
  /cleanup results unconfirmed/i);
 assert.equal(f.inserted.at(-1),'interviews');
 assert.equal(f.deleted[0],'interviews');
 assert.equal(f.deleted.at(-1),'clients');
 assert.equal(f.tables.profiles.length,8);
 assert.equal(f.tables.user_roles.length,8);
 assert.equal(f.tables.candidates.length,2);
 for(const [t] of Object.entries(EXPECTED_EXTENDED_COUNTS))assert.equal(f.tables[t].length,0,t);
});
