import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_ID,slotEmail
} from './provision-nine-auth-users.mjs';
import {
  expectedRoles,makeBaseFixture,seedInertBaseFixture
} from './seed-inert-base-fixture.mjs';

const id=i=>`0000000${i}-1111-4111-8111-00000000000${i}`;
const roleId=i=>`aaaaaaaa-aaaa-4aaa-8aaa-00000000000${i}`;
const mapping=()=>({project_id:PROJECT_ID,users:Array.from({length:9},(_,i)=>({
   slot:i+1,id:id(i+1),email:slotEmail(i+1)
}))});
const generator=()=>{let i=0;return ()=>roleId(++i);};
function lab(options={}){
 const state={profiles:[],user_roles:[],candidates:[]};
 const deleted=[];
 let attempted=[];
 const client={
  auth:{admin:{listUsers:async()=>({data:{users:options.existingAuth ||
    mapping().users.map(({id,email})=>({id,email}))},error:null})}},
  from:table=>({
   select:(columns,opts)=>{
      if(opts?.head)return Promise.resolve({count:state[table].length,error:null});
      const rows=state[table].map(r=>Object.fromEntries(columns.split(',').map(col=>[col,r[col]])));
      if(options.corruptStatus && table==='profiles'&&rows.length)rows[0].status='suspended';
      return Promise.resolve({data:rows,error:null});
   },
   insert:rows=>{
     attempted.push(table);
     state[table].push(...rows);
     return {select:async()=>options.failInsert===table
       ? {data:null,error:{status:503}}
       :{data:rows.map(r=>({id:r.id})),error:null}};
   },
   delete:()=>({in:async(col,values)=>{
     if(col!=='id')throw Error('Must delete only exact IDs');
     deleted.push(table);
     state[table]=state[table].filter(row=>!values.includes(row.id));
     return {error:null};
   }})
  })
 };
 return {client,state,deleted,attempted};
}

test('source-bound fixture exactly mirrors 8 approved role/status slots and leaves slot 9 absent',()=>{
 const p=makeBaseFixture(mapping(),'2026-11-13T00:00:00Z',generator());
 assert.equal(p.profiles.length,8);
 assert.equal(p.roles.length,8);
 assert.equal(p.candidates.length,2);
 for(let i=0;i<8;i++){
   assert.equal(p.profiles[i].id,id(i+1));
   assert.equal(p.profiles[i].status,expectedRoles[i][1]);
   assert.equal(p.profiles[i].is_active,expectedRoles[i][2]);
   assert.equal(p.roles[i].role,expectedRoles[i][0]);
 }
 assert(!p.profiles.some(u=>u.id===id(9)));
 assert(!p.roles.some(u=>u.user_id===id(9)));
 for(let i=0;i<2;i++){
   assert.equal(p.candidates[i].id,id(i+2));
   assert.equal(p.candidates[i].assigned_recruiter,id(i+2));
   assert(p.candidates[i].email.endsWith('@example.invalid'));
   assert.equal(p.candidates[i].stage,'lead_received');
   assert.notEqual(p.candidates[i].stage,'joined');
 }
});

test('refuse wrong project, unexpected email, duplicate UUID and unmapped slot',()=>{
 for(const alteration of [
   x=>x.project_id='wusntntcqgtpgokggdzv',
   x=>x.users[0].email='external@example.com',
   x=>x.users[8].id=x.users[7].id,
   x=>x.users[0].slot=9
 ]){const a=mapping();alteration(a);
   assert.throws(()=>makeBaseFixture(a,'2026-11-13T00:00:00Z',generator()));
 }
});

test('exact real Auth Admin mapping required before any profile insertion',async()=>{
 const f=lab({existingAuth:[]});
 await assert.rejects(seedInertBaseFixture(f.client,mapping(),
   {now:'2026-11-13T00:00:00Z',generateId:generator()}));
 assert.deepEqual(f.attempted,[]);
});

test('refuse nonempty hosted fixture before starting writes',async()=>{
 const f=lab();f.state.profiles.push({id:id(1)});
 await assert.rejects(seedInertBaseFixture(f.client,mapping(),
  {now:'2026-11-13T00:00:00Z',generateId:generator()}));
 assert.deepEqual(f.attempted,[]);
});

test('mocked successful seed is exactly 8/8/2 and excludes slot nine',async()=>{
 const f=lab();
 const out=await seedInertBaseFixture(f.client,mapping(),
    {now:'2026-11-13T00:00:00Z',generateId:generator()});
 assert.deepEqual(out,{profiles:8,roles:8,candidates:2,formal_uat_accepted:0});
 assert.deepEqual(f.attempted,['profiles','user_roles','candidates']);
 assert.equal(f.state.profiles.length,8);
 assert.equal(f.state.user_roles.length,8);
 assert.equal(f.state.candidates.length,2);
 assert(!f.state.user_roles.some(r=>r.user_id===id(9)));
 assert.equal(f.state.candidates[0].id,id(2));
 assert.equal(f.state.candidates[1].id,id(3));
});

test('uncertain insert response after public profile write triggers exact-ID compensation',async()=>{
 const f=lab({failInsert:'profiles'});
 await assert.rejects(seedInertBaseFixture(f.client,mapping(),
   {now:'2026-11-13T00:00:00Z',generateId:generator()}),/cleanup/);
 assert.deepEqual(f.deleted,['profiles']);
 assert.equal(f.state.profiles.length,0);
});

test('second-table failure compensates roles then profiles without touching Auth users',async()=>{
 const f=lab({failInsert:'user_roles'});
 await assert.rejects(seedInertBaseFixture(f.client,mapping(),
   {now:'2026-11-13T00:00:00Z',generateId:generator()}),/cleanup/);
 assert.deepEqual(f.deleted,['user_roles','profiles']);
 assert.equal(f.state.user_roles.length,0);
 assert.equal(f.state.profiles.length,0);
});

test('mismatched postseed privilege status compensates all three table batches',async()=>{
 const f=lab({corruptStatus:true});
 await assert.rejects(seedInertBaseFixture(f.client,mapping(),
   {now:'2026-11-13T00:00:00Z',generateId:generator()}),/cleanup/);
 assert.deepEqual(f.deleted,['candidates','user_roles','profiles']);
 assert.equal(f.state.candidates.length,0);
 assert.equal(f.state.user_roles.length,0);
 assert.equal(f.state.profiles.length,0);
});
