import {createHmac} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const rows=JSON.parse(readFileSync('security/build41/signed-http-135-read-matrix.json','utf8')).read_cases;
const secret=process.env.B41_JWT_SECRET;
assert.ok(secret?.length>=32,'Synthetic JWT secret missing');
const url='http://127.0.0.1:3000';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333';
const now=Math.floor(Date.now()/1000);
const base64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function sign(sub,change={}){
 const unsigned=base64({typ:'JWT',alg:'HS256'})+'.'+base64({role:'authenticated',sub,iat:now-10,exp:now+3600,...change});
 return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
}
async function query(path,subject,method='GET',body,override){
 const token=override===undefined?sign(subject):override;
 const headers={Accept:'application/json'};
 if(token!==null)headers.Authorization='Bearer '+token;
 if(body!==undefined){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const result=await fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const raw=await result.text();let data;
 try{data=JSON.parse(raw)}catch{data=raw}
 return {status:result.status,data};
}
const evidence=[],failures=[];
function check(id,want,got,pass,data){
 evidence.push({case_id:id,expected:want,observed:got,pass});
 if(!pass)failures.push({case_id:id,expected:want,observed:got,response:String(JSON.stringify(data)).slice(0,250)});
}
let schemaReady=false;
for(let retry=0;retry<30;retry++){
 const warm=await query('/profiles?select=id','11111111-1111-4111-8111-111111111111');
 if(warm.status===200){schemaReady=true;break}
 await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(schemaReady,'PostgREST schema cache did not become ready for a signed authenticated request');
for(const r of rows){
 const x=await query('/'+r.table+'?select=id',r.sub);
 const n=Array.isArray(x.data)?x.data.length:null;
 check(r.case_id,'200 and '+r.expected+' rows',x.status+' and '+n+' rows',x.status===200&&n===r.expected,x.data);
}
async function mutation(id,sub,path,method,body,expected){
 const x=await query(path,sub,method,body);
 const count=Array.isArray(x.data)?x.data.length:null;
 const pass=expected==='one'?x.status===200&&count===1:expected==='zero'?x.status===200&&count===0:x.status===403;
 check(id,expected,x.status+' and '+count+' rows',pass,x.data);
}
await mutation('B41-SIGNED-WRITE-136',A,'/candidates?id=eq.'+A,'PATCH',{stage:'screening'},'one');
await mutation('B41-SIGNED-WRITE-137',A,'/candidates?id=eq.'+B,'PATCH',{stage:'screening'},'zero');
await mutation('B41-SIGNED-WRITE-138',A,'/candidates?id=eq.'+A,'PATCH',{assigned_recruiter:B},'403');
await mutation('B41-SIGNED-WRITE-139',A,'/user_roles','POST',{user_id:A,role:'admin'},'403');
await mutation('B41-SIGNED-WRITE-140',F,'/billing','POST',{id:'99999999-9999-4999-8999-999999999999'},'403');
const negative=[
 ['B41-NEGATIVE-EXPIRED',sign(A,{iat:now-7200,exp:now-3600}),[401]],
 ['B41-NEGATIVE-MALFORMED','not.a.signed.jwt',[401]],
 ['B41-NEGATIVE-TAMPERED',sign(A).slice(0,-7)+'tampered',[401]],
 ['B41-NEGATIVE-ANONYMOUS',null,[401,403]]
];
for(const [id,token,want] of negative){const x=await query('/candidates?select=id',A,'GET',undefined,token);check(id,want.join('/'),x.status,want.includes(x.status),x.data)}
assert.equal(rows.length,135);
assert.equal(evidence.length,144);
const pass=evidence.filter(x=>x.pass).length;
const report={environment:'DISPOSABLE_POSTGREST_NOT_HOSTED_SUPABASE_AUTH',signed_core:140,negative_cases:4,total:144,pass,failed:failures.length,results:evidence,failures};
writeFileSync('/tmp/build41-signed-http-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log('Build41 signed-JWT HTTP matrix: '+pass+'/144 PASS; 140 core cases plus 4 negative controls');
for(const f of failures.slice(0,16))console.error('FAIL '+f.case_id+' expected='+f.expected+' observed='+f.observed+' '+f.response);
if(failures.length)process.exitCode=1;
