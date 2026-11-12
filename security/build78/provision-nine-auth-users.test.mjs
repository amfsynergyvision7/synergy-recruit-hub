import test from 'node:test';
import assert from 'node:assert/strict';
import {
 PROJECT_ID,PROJECT_URL,ACK,slotEmail,planFromEnv,provisionNine
} from './provision-nine-auth-users.mjs';

const env = () => {
 const e = {
  AMF_UAT_MODE:'EXECUTE',AMF_UAT_ACK:ACK,AMF_UAT_PROJECT_ID:PROJECT_ID,
  AMF_UAT_SUPABASE_URL:PROJECT_URL,AMF_UAT_SERVICE_ROLE_KEY:'sb_secret_abcdefghijklmnopqrstuvwxyz',
  AMF_UAT_MAPPING_FILE:'/tmp/build78-protected/synthetic-map.json'
 };
 for(let i=1;i<=9;i++)
  e[`AMF_UAT_CASE_${String(i).padStart(2,'0')}_PASSWORD`]=`ExampleNONPRODsecretSTRING9Aa${i}`;
 return e;
};
const validId = i=>`0000000${i}-1111-4111-8111-00000000000${i}`;
const fake = ({failureSlot=0,failAfter=false,adminRoleSlot=0,wrongEmailSlot=0}={}) => {
 let created = [],creationAttempts = 0, deleted = [];
 const admin = {
  listUsers:async()=>({data:{users:failAfter&&created.length===9
    ? [...created,{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',email:'unexpected@example.invalid'}]
    : [...created] },error:null}),
  createUser:async args=>{
    creationAttempts++;
    if(creationAttempts===failureSlot)return {data:{user:null},error:{status:500}};
    const u={id:validId(creationAttempts),email:
      creationAttempts===wrongEmailSlot?'changed@example.invalid':args.email,
      role:creationAttempts===adminRoleSlot?'service_role':'authenticated'};
    created.push(u);
    return {data:{user:u},error:null};
  },
  deleteUser:async id=>{deleted.push(id);created=created.filter(u=>u.id!==id);return {error:null}}
 };
 return {admin,get state(){return {created:[...created],deleted:[...deleted],creationAttempts}}};
};

test('fixed synthetic 9-slot project and invalid email domain; secret-managed plans only',()=>{
 const p=planFromEnv(env(),'/work/repository');
 assert.equal(p.url,'https://dhlhlasnaapzckjyvffn.supabase.co');
 assert.equal(p.users.length,9);
 assert.equal(new Set(p.users.map(u=>u.email)).size,9);
 assert(p.users.every(u=>u.email.endsWith('@example.invalid')));
 assert.equal(slotEmail(9),'amf-uat-09@example.invalid');
});

test('refuse wrong project, missing acknowledgement, publishable key, weak/duplicate credentials',()=>{
 for (const [key,value] of [
  ['AMF_UAT_PROJECT_ID','wusntntcqgtpgokggdzv'],
  ['AMF_UAT_SUPABASE_URL','https://wusntntcqgtpgokggdzv.supabase.co'],
  ['AMF_UAT_MODE','DRY_RUN'],
  ['AMF_UAT_ACK','yes'],
  ['AMF_UAT_SERVICE_ROLE_KEY','sb_publishable_not_a_service_role'],
  ['AMF_UAT_CASE_01_PASSWORD','weak'],
  ['AMF_UAT_MAPPING_FILE','/work/repository/secrets/mapping.json']
 ]){const e=env();e[key]=value;assert.throws(()=>planFromEnv(e,'/work/repository'),undefined,`must fail ${key}`);}
 const e=env();e.AMF_UAT_CASE_09_PASSWORD=e.AMF_UAT_CASE_01_PASSWORD;
 assert.throws(()=>planFromEnv(e));
});

test('refuse JWT authorization that is not a service_role token',()=>{
 const e=env();const b=(x)=>Buffer.from(JSON.stringify(x)).toString('base64url');
 e.AMF_UAT_SERVICE_ROLE_KEY=`${b({alg:'HS256'})}.${b({role:'anon'})}.signature`;
 assert.throws(()=>planFromEnv(e));
});

test('real Admin API path: exact 9 GoTrue users, no user metadata or privileged role request',async()=>{
 const p=planFromEnv(env(),'/work/repository');
 const f=fake();let mapping;
 const spy={...f.admin,createUser:async args=>{
  assert.equal(args.email_confirm,true);
  assert.equal(args.user_metadata,undefined);
  assert.equal(args.app_metadata,undefined);
  assert.equal(args.role,undefined);
  return f.admin.createUser(args);
 }};
 const output=await provisionNine(p,spy,async data=>{mapping=data;});
 assert.deepEqual(output,{created_count:9,auth_tenant_verified:true});
 assert.equal(f.state.created.length,9);
 assert.equal(f.state.deleted.length,0);
 assert.equal(mapping.project_id,PROJECT_ID);
 assert.equal(mapping.users.length,9);
 assert(!JSON.stringify(mapping).includes('ExampleNONPRODsecretSTRING'));
});

test('preexisting Auth identity blocks all provisioning',async()=>{
 const p=planFromEnv(env(),'/work/repository');
 const f=fake();const admin={...f.admin,listUsers:async()=>({data:{users:[{id:validId(1)}]},error:null})};
 await assert.rejects(provisionNine(p,admin,async()=>{}),/tenant not verified empty/);
 assert.equal(f.state.creationAttempts,0);
});

test('failed slot cleans up earlier successful users; no secrets in error',async()=>{
 const p=planFromEnv(env(),'/work/repository'),f=fake({failureSlot:4});
 await assert.rejects(provisionNine(p,f.admin,async()=>{}),e=>{
  assert(!e.message.includes('ExampleNONPRODsecretSTRING'));
  assert.match(e.message,/provisioning aborted/i);
  return true;
 });
 assert.equal(f.state.created.length,0);
 assert.equal(f.state.deleted.length,3);
});

test('unexpected privilege or wrong email is rejected and cleaned up',async()=>{
 for(const bad of [{adminRoleSlot:3},{wrongEmailSlot:2}]){
  const p=planFromEnv(env(),'/work/repository'),f=fake(bad);
  await assert.rejects(provisionNine(p,f.admin,async()=>{}));
  assert.equal(f.state.created.length,0);
  assert.equal(f.state.deleted.length,bad.adminRoleSlot||bad.wrongEmailSlot);
 }
});

test('unexpected postcreation tenant drift causes attempted full compensation',async()=>{
 const p=planFromEnv(env(),'/work/repository'),f=fake({failAfter:true});
 await assert.rejects(provisionNine(p,f.admin,async()=>{}));
 assert.equal(f.state.deleted.length,9);
 assert.equal(f.state.created.length,0);
});

test('failure persisting protected UUID mapping also compensates nine accounts',async()=>{
 const p=planFromEnv(env(),'/work/repository'),f=fake();
 await assert.rejects(provisionNine(p,f.admin,async()=>{throw new Error('write failed');}));
 assert.equal(f.state.deleted.length,9);
});
