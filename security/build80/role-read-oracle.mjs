/**
 * Build 80: frozen historical 135-case synthetic-only authorization oracle.
 *
 * This is a pure in-memory *design comparison*, not a deployed RLS policy,
 * verified GoTrue token, PostgREST result, or formal UAT acceptance.
 *
 * Uses exact source-shaped 19-table Build78/79 invented records. Never copies
 * production user/candidate data. Never authorizes 5 historical write cases.
 */
import {readFileSync} from 'node:fs';
import {makeBaseFixture} from '../build78/seed-inert-base-fixture.mjs';
import {composeExtendedFixture} from '../build79/compose-and-seed-remaining-fixture.mjs';
import {PROJECT_ID,slotEmail} from '../build78/provision-nine-auth-users.mjs';

const frozen=JSON.parse(readFileSync(
  new URL('../build41/signed-http-135-read-matrix.json',import.meta.url),'utf8'));
export const READ_TABLES=Object.freeze([
 'audit_logs','billing','candidate_activities','candidates','clients',
 'google_integrations','integrations','interviews','job_openings',
 'notifications','offers','profiles','submissions','sync_logs','user_roles'
]);
export const PRIVATE_DENY_TABLES=Object.freeze([
 'app_settings','candidate_stage_history','email_log','workflow_rules'
]);
export const FORBIDDEN_DIRECT_WRITES=Object.freeze([
 'INSERT','UPDATE','DELETE','TRUNCATE','EXECUTE'
]);
export const testAccountId=i=>`0000000${i}-1111-4111-8111-00000000000${i}`;

function uuidSequence(prefix){
 let n=0;
 return ()=>`${prefix}-dddd-4ddd-8ddd-${String(++n).padStart(12,'0')}`;
}
export function syntheticAuthorizationFixture(){
 const mapping={project_id:PROJECT_ID,users:Array.from({length:9},(_,i)=>({
   slot:i+1,id:testAccountId(i+1),email:slotEmail(i+1)
 }))};
 const ts='2026-11-13T00:00:00.000Z';
 const base=makeBaseFixture(mapping,ts,uuidSequence('bbbbbbbb'));
 const extended=composeExtendedFixture(mapping,ts,uuidSequence('cccccccc'));
 const rows={
  profiles:base.profiles,user_roles:base.roles,candidates:base.candidates,
  ...Object.fromEntries(extended.batches.map(b=>[b.table,b.rows]))
 };
 return {mapping,rows,originalCases:frozen.read_cases};
}
const isRowOwned=(rows,uid,candidateId)=>
 rows.candidates.some(c=>c.id===candidateId && c.assigned_recruiter===uid);

/** Return the exact synthetic rows an actor ought to see, from the frozen
 * business permission proposal. This function never talks to a database. */
export function expectedReadableRows(rows,uid,table){
 if(!Array.isArray(rows?.[table]))throw new Error('Unknown exact synthetic CRM table');
 const profile=rows.profiles.find(p=>p.id===uid);
 const roles=rows.user_roles.filter(r=>r.user_id===uid);
 if(!profile || roles.length!==1)return [];
 const role=roles[0].role;
 const approved=profile.status==='approved' && profile.is_active===true;
 const admin=approved&&role==='admin';
 const recruiter=approved&&role==='recruiter';
 const finance=approved&&role==='finance';

 if(table==='profiles')return rows.profiles.filter(p=>admin || p.id===uid);
 if(table==='user_roles')return rows.user_roles.filter(r=>admin || r.user_id===uid);
 // Pending, inactive, viewer and unprofiled accounts are never promoted by
 // role alone; only the two personal tables above may return anything.
 if(table==='candidates')return rows.candidates.filter(r=>
    admin || (recruiter && r.assigned_recruiter===uid));
 if(table==='job_openings')return rows.job_openings.filter(r=>
    admin || (recruiter && r.assigned_recruiter===uid));
 if(table==='submissions'||table==='interviews')return rows[table].filter(r=>
    admin || (recruiter &&
      isRowOwned(rows,uid,r.candidate_uuid??r.candidate_id)));
 if(table==='notifications')return rows.notifications.filter(r=>
    admin || (recruiter && r.user_id===uid));
 if(table==='billing')return admin||finance?rows.billing.slice():[];
 if(table==='google_integrations')return rows.google_integrations.filter(r=>
    admin && r.user_id===uid);
 if(table==='audit_logs'||table==='candidate_activities'||table==='clients'||
    table==='integrations'||table==='offers'||table==='sync_logs')
   return admin?rows[table].slice():[];
 return []; // all four omitted/other public application tables are denied
}
export function evaluateHistorical135(){
 const {mapping,rows,originalCases}=syntheticAuthorizationFixture();
 if(!Array.isArray(originalCases)||originalCases.length!==135)
  throw new Error('Frozen historical count was modified');
 const expectedSubjects=[
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888'
 ];
 const failures=[];
 const subjects=[...new Set(originalCases.map(c=>c.sub))];
 if(subjects.length!==9||subjects.some((s,i)=>s!==expectedSubjects[i]))
   throw new Error('Frozen historical subjects were changed');
 for(let i=0;i<originalCases.length;i++){
  const c=originalCases[i];
  if(c.case_id!==`B41-SIGNED-READ-${String(i+1).padStart(3,'0')}` ||
    c.sub!==expectedSubjects[Math.floor(i/15)] ||
    c.table!==READ_TABLES[i%15])
    throw new Error('Frozen case ID/order/table is inconsistent with historical matrix');
  const uid=mapping.users[Math.floor(i/15)].id;
  const observed=expectedReadableRows(rows,uid,c.table).length;
  if(observed!==c.expected)failures.push({
    case_id:c.case_id,table:c.table,expected:c.expected,model_observed:observed
  });
 }
 return Object.freeze({
   expected_cases:135,
   pure_model_pass:135-failures.length,
   pure_model_failures:failures,
   simulated_go_true_sessions:0,
   actual_hosted_signed_cases:0,
   accepted_uat_cases:0,
   writes_attempted:0,
   qualification:'OFFLINE_MODEL_ONLY_NOT_REAL_RLS_OR_RELEASE_ACCEPTANCE'
 });
}
export function mayDirectlyMutateAnyCRMTable(){return false;}
