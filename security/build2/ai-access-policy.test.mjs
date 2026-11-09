import test from 'node:test';
import assert from 'node:assert/strict';
import {canRead,projectAllowedFields} from './ai-access-policy.mjs';
const record={kind:'interview',assigned_recruiter:'rec1',authorized_operations_user_id:'ops1',candidate_name:'Synthetic Candidate',interview_date:'2026-12-01',interview_status:'scheduled',phone:'000',email:'synthetic@example.invalid',resume:'synthetic resume',salary:100};
const user=(role,id='x',status='approved',is_active=true)=>({role,id,status,is_active});
const cases=[
 ['admin allowed',user('admin'),'candidate_name',true],
 ['recruiter assigned allowed',user('recruiter','rec1'),'candidate_name',true],
 ['recruiter other denied',user('recruiter','rec2'),'candidate_name',false],
 ['operations authorized name',user('operations','ops1'),'candidate_name',true],
 ['operations authorized date',user('operations','ops1'),'interview_date',true],
 ['operations unassigned denied',user('operations','ops2'),'candidate_name',false],
 ['operations phone denied',user('operations','ops1'),'phone',false],
 ['operations email denied',user('operations','ops1'),'email',false],
 ['operations resume denied',user('operations','ops1'),'resume',false],
 ['operations salary denied',user('operations','ops1'),'salary',false],
 ['finance denied',user('finance'),'candidate_name',false],
 ['viewer denied',user('viewer'),'candidate_name',false],
 ['unknown role denied',user('superuser'),'candidate_name',false],
 ['pending denied',user('admin','x','pending'),'candidate_name',false],
 ['inactive denied',user('admin','x','approved',false),'candidate_name',false],
 ['unknown field denied',user('admin'),'secret',false]
];
for(const [name,u,field,expected] of cases)test(name,()=>assert.equal(canRead({user:u,record,field}),expected));
test('write denied',()=>assert.equal(canRead({user:user('admin'),record,field:'candidate_name',action:'write'}),false));
test('send denied',()=>assert.equal(canRead({user:user('admin'),record,field:'candidate_name',action:'send'}),false));
test('operations missing assignment denied',()=>assert.equal(canRead({user:user('operations','ops1'),record:{...record,authorized_operations_user_id:undefined},field:'candidate_name'}),false));
test('operations non-interview denied',()=>assert.equal(canRead({user:user('operations','ops1'),record:{...record,kind:'candidate'},field:'candidate_name'}),false));
test('operations projection excludes sensitive fields',()=>{const p=projectAllowedFields({user:user('operations','ops1'),record});assert.equal(p.candidate_name,'Synthetic Candidate');for(const f of ['phone','email','resume','salary'])assert.equal(Object.hasOwn(p,f),false)});

test('missing admin identity is denied',()=>assert.equal(canRead({user:user('admin',''),record,field:'candidate_name'}),false));
test('blank recruiter identity is denied',()=>assert.equal(canRead({user:user('recruiter',' '),record,field:'candidate_name'}),false));
test('non-interview admin record is denied',()=>assert.equal(canRead({user:user('admin'),record:{...record,kind:'candidate'},field:'candidate_name'}),false));
test('non-interview recruiter record is denied',()=>assert.equal(canRead({user:user('recruiter','rec1'),record:{...record,kind:'candidate'},field:'candidate_name'}),false));
test('missing record kind is denied',()=>assert.equal(canRead({user:user('admin'),record:{candidate_name:'Synthetic Candidate'},field:'candidate_name'}),false));
test('suspended admin is denied',()=>assert.equal(canRead({user:user('admin','x','suspended'),record,field:'candidate_name'}),false));
test('rejected recruiter is denied',()=>assert.equal(canRead({user:user('recruiter','rec1','rejected'),record,field:'candidate_name'}),false));
test('admin projection excludes candidate contact details',()=>{const projection=projectAllowedFields({user:user('admin'),record});for(const f of ['phone','email','resume','salary'])assert.equal(Object.hasOwn(projection,f),false)});
