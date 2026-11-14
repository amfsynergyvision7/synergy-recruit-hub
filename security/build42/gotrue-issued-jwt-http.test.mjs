/**
 * Build 42 disposable Supabase Auth/GoTrue-issued JWT API proof.
 * PostgreSQL 17 + GoTrue + PostgREST are running on this GitHub Actions runner.
 * This does NOT connect to a real hosted Supabase project or user record.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';

const matrix=JSON.parse(readFileSync('security/build41/signed-http-135-read-matrix.json','utf8')).read_cases;
const subjects=[...new Set(matrix.map(x=>x.sub))];
assert.equal(subjects.length,9);
const authUrl='http://127.0.0.1:9999',restUrl='http://127.0.0.1:3000';
const syntheticPassword='Build42_Only_Disposable_Test_9x7bA';
const tokenBySubject=new Map();
const mappedIdBySubject=new Map();
async function responseJson(url,options={}){
 const response=await fetch(url,{signal:AbortSignal.timeout(9000),...options});
 const txt=await response.text();let data;
 try{data=JSON.parse(txt)}catch{data=txt}
 return {status:response.status,data};
}
async function signup(oldId,index){
 const email='build42-synthetic-'+String(index+1)+'@example.com';
 const body={email,password:syntheticPassword,data:{synthetic_build:'B42',old_case_subject:String(index+1)}};
 const signed=await responseJson(authUrl+'/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(signed.status!==200 && signed.status!==201)throw Error('GoTrue signup rejected synthetic user #'+index+': '+signed.status+' '+JSON.stringify(signed.data).slice(0,180));
 const issuedId=signed.data?.user?.id ?? signed.data?.id;
 assert.match(String(issuedId),/^[a-f0-9-]{36}$/i,'Missing GoTrue-issued user UUID');
 // GoTrue must actually issue an access token through the password grant.
 const signedIn=await responseJson(authUrl+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:syntheticPassword})});
 if(signedIn.status!==200 || typeof signedIn.data?.access_token!=='string')throw Error('GoTrue password login failed user #'+index+': '+signedIn.status+' '+JSON.stringify(signedIn.data).slice(0,180));
 const token=signedIn.data.access_token;
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.sub,issuedId,'Token subject differs from Auth user ID');
 assert.equal(claims.role,'authenticated','Token role is not authenticated');
 assert.ok(Number(claims.exp)>Math.floor(Date.now()/1000),'GoTrue-issued token expired');
 mappedIdBySubject.set(oldId,issuedId);
 tokenBySubject.set(oldId,token);
}
for(let i=0;i<subjects.length;i++)await signup(subjects[i],i);
assert.equal(tokenBySubject.size,9);
// Rewrite ONLY synthetic fixture UUIDs in the disposable Postgres public tables
// to match the real freshly-issued GoTrue auth.users IDs. Never touch auth.users.
const syntheticPairs=[...mappedIdBySubject].map(([oldId,newId])=>"('"+oldId+"'::uuid,'"+newId+"'::uuid)").join(',');
const reconcileSql=[
 'BEGIN;',
 'CREATE TEMP TABLE b42_id_map(old_id uuid PRIMARY KEY,new_id uuid UNIQUE NOT NULL) ON COMMIT DROP;',
 'INSERT INTO b42_id_map(old_id,new_id) VALUES '+syntheticPairs+';',
 'DO $fixture$ DECLARE col record; n integer:=0; BEGIN',
 'FOR col IN SELECT c.table_name,c.column_name FROM information_schema.columns c',
 "WHERE c.table_schema='public' AND c.udt_name='uuid' AND c.table_name IN",
 "('audit_logs','billing','candidate_activities','candidates','clients','google_integrations','integrations','interviews','job_openings','notifications','offers','profiles','submissions','sync_logs','user_roles')",
 'LOOP EXECUTE format(',
 " 'UPDATE public.%I AS target SET %I=map.new_id FROM b42_id_map AS map WHERE target.%I=map.old_id',",
 ' col.table_name,col.column_name,col.column_name);',
 'n:=n+1; END LOOP;',
 "IF n<15 THEN RAISE EXCEPTION 'Synthetic UUID column update incomplete %',n; END IF;",
 'END $fixture$;',
 'COMMIT;'
].join('\n');
const sql=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-h','localhost','-U','postgres','-d','postgres'],{input:reconcileSql,env:process.env,encoding:'utf8',timeout:25000});
if(sql.status!==0)throw Error('Failed to reconcile disposable source-shaped user IDs: '+String(sql.stderr).slice(0,600));
let ready=false;
for(let i=0;i<30;i++){
 const probe=await responseJson(restUrl+'/profiles?select=id',{headers:{Authorization:'Bearer '+tokenBySubject.get(subjects[1])}});
 if(probe.status===200){ready=true;break}
 await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(ready,'PostgREST schema not ready for Auth-issued user');
async function request(path,oldSub,method='GET',body,tokenMode='normal'){
 const headers={Accept:'application/json'};
 let bearer=tokenBySubject.get(oldSub);
 if(tokenMode==='tampered')bearer=bearer.slice(0,-7)+'corrupt';
 if(tokenMode==='none')bearer=null;
 if(bearer)headers.Authorization='Bearer '+bearer;
 if(body!==undefined){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 return await responseJson(restUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
const outcomes=[],failed=[];
function check(id,expected,observed,pass,more){
 outcomes.push({case_id:id,expected,observed,pass});
 if(!pass)failed.push({case_id:id,expected,observed,detail:JSON.stringify(more).slice(0,220)});
}
for(const c of matrix){
 const x=await request('/'+c.table+'?select=id',c.sub);
 const count=Array.isArray(x.data)?x.data.length:null;
 check(c.case_id,'HTTP 200 and '+c.expected+' rows',x.status+' / '+count,x.status===200&&count===c.expected,x.data);
}
assert.equal(matrix.length,135);
const r1=subjects[1],r2=subjects[2],finance=subjects[3];
const user1=mappedIdBySubject.get(r1),user2=mappedIdBySubject.get(r2);
async function mutation(id,sub,path,method,payload,kind){
 const x=await request(path,sub,method,payload);
 const n=Array.isArray(x.data)?x.data.length:null;
 const pass=kind==='own'?x.status===200&&n===1:kind==='other'?x.status===200&&n===0:x.status===403;
 check(id,kind,x.status+' / '+n,pass,x.data);
}
await mutation('B42-GOTRUE-WRITE-136',r1,'/candidates?id=eq.'+user1,'PATCH',{stage:'screening'},'own');
await mutation('B42-GOTRUE-WRITE-137',r1,'/candidates?id=eq.'+user2,'PATCH',{stage:'screening'},'other');
await mutation('B42-GOTRUE-WRITE-138',r1,'/candidates?id=eq.'+user1,'PATCH',{assigned_recruiter:user2},'forbidden');
await mutation('B42-GOTRUE-WRITE-139',r1,'/user_roles','POST',{user_id:user1,role:'admin'},'forbidden');
await mutation('B42-GOTRUE-WRITE-140',finance,'/billing','POST',{id:'99999999-9999-4999-8999-999999999999'},'forbidden');
const noAuth=await request('/candidates?select=id',r1,'GET',undefined,'none');
check('B42-GOTRUE-NEGATIVE-ANON','HTTP 401/403',noAuth.status,[401,403].includes(noAuth.status),noAuth.data);
const corrupt=await request('/candidates?select=id',r1,'GET',undefined,'tampered');
check('B42-GOTRUE-NEGATIVE-TAMPERED','HTTP 401',corrupt.status,corrupt.status===401,corrupt.data);
const totals={test_environment:'EPHEMERAL_GOTRUE_ISSUED_SESSIONS_AND_POSTGREST_NOT_HOSTED_SUPABASE',issuer:'supabase/gotrue:v2.197.0',identities:9,read_count:135,write_count:5,negative_count:2,case_count:outcomes.length,passed:outcomes.filter(x=>x.pass).length,failed:failed.length,case_results:outcomes,failures:failed};
writeFileSync('/tmp/build42-gotrue-issued-auth-results.json',JSON.stringify(totals,null,2)+'\n');
console.log('Build42 GoTrue-issued signed API HTTP: '+totals.passed+'/'+totals.case_count+' PASS, core '+outcomes.filter(x=>x.case_id.startsWith('B41-')||x.case_id.startsWith('B42-GOTRUE-WRITE')).filter(x=>x.pass).length+'/140; synthetic test users='+tokenBySubject.size);
if(failed.length){for(const f of failed.slice(0,12))console.error('FAIL '+f.case_id+' expected '+f.expected+' got '+f.observed+' '+f.detail);process.exitCode=1}
else console.log('PASS: GoTrue password-authenticated issued JWTs validate RLS through PostgREST; no live records touched');
