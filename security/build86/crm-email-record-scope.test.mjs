import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCrmEmailRecordReadable} from '../../src/lib/crm-email-recipient-policy.ts';

const actor='11111111-1111-4111-8111-111111111111';
const peer='22222222-2222-4222-8222-222222222222';
const file=name=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const handler=file('src/lib/email.functions.ts');
const gate=file('src/lib/crm-email-record-access.server.ts');
const history=handler.slice(handler.indexOf('export const listEmailHistory'),handler.indexOf('export interface EmailMergeContext'));
const merge=handler.slice(handler.indexOf('export const getEmailMergeContext'));

test('Build86 recruiter may read only their own candidate email record',()=>{
 assert.equal(isCrmEmailRecordReadable({relatedTable:'candidates',record:{assigned_recruiter:actor},actingUserId:actor,approvedRole:'recruiter'}),true);
 assert.equal(isCrmEmailRecordReadable({relatedTable:'candidates',record:{assigned_recruiter:peer},actingUserId:actor,approvedRole:'recruiter'}),false);
 assert.equal(isCrmEmailRecordReadable({relatedTable:'candidates',record:{assigned_recruiter:null},actingUserId:actor,approvedRole:'recruiter'}),false);
});
test('Build86 approved admin may read candidate and client record, recruiter cannot read client',()=>{
 assert.equal(isCrmEmailRecordReadable({relatedTable:'candidates',record:{assigned_recruiter:peer},actingUserId:actor,approvedRole:'admin'}),true);
 assert.equal(isCrmEmailRecordReadable({relatedTable:'clients',record:{},actingUserId:actor,approvedRole:'admin'}),true);
 assert.equal(isCrmEmailRecordReadable({relatedTable:'clients',record:{},actingUserId:actor,approvedRole:'recruiter'}),false);
});
test('Build86 invalid identity, unknown table/role and absent records fail closed',()=>{
 const good={relatedTable:'candidates',record:{assigned_recruiter:actor},actingUserId:actor,approvedRole:'recruiter'};
 for(const update of [{record:null},{actingUserId:'not-uuid'},{approvedRole:'viewer'},{approvedRole:'finance'},{relatedTable:'billing'},{record:undefined}]){
  assert.equal(isCrmEmailRecordReadable({...good,...update}),false);
 }
});
test('Build86 shared server read gate verifies unique role, signed access, ownership and record existence',()=>{
 const unique=gate.indexOf('memberships.length !== 1');
 const signed=gate.indexOf('await assertApprovedRole(actorId, ["admin", "recruiter"])');
 const candidate=gate.indexOf('.from("candidates")');
 const clients=gate.indexOf('.from("clients")');
 const selector=gate.indexOf('isCrmEmailRecordReadable({');
 assert(signed>=0 && unique>signed && candidate>unique && clients>unique && selector>candidate);
 assert(gate.includes('role !== "admin" && role !== "recruiter"'));
 assert(gate.includes('relatedTable === "clients" && approvedRole !== "admin"'));
 assert(gate.includes('return;'));
 assert(!gate.includes('supabaseAdmin'));
});
test('Build86 history endpoint requires record scope before email log query and returns only needed fields',()=>{
 const role=history.indexOf('await assertApprovedRole(context.userId, ["admin", "recruiter"])');
 const owner=history.indexOf('await assertCrmEmailRecordReadAccess({');
 const select=history.indexOf('.from("email_log" as any)');
 assert(role>=0&&owner>role&&select>owner);
 assert(history.includes('.select("id,subject,status,created_at,to_email")'));
 assert(!history.includes('.select("*")'));
 assert(!history.includes('throw new Error(error.message)'));
});
test('Build86 template merge context checks per-record authorization before retrieving related submissions/clients',()=>{
 const role=merge.indexOf('await assertApprovedRole(context.userId, ["admin", "recruiter"])');
 const owner=merge.indexOf('await assertCrmEmailRecordReadAccess({');
 const profiles=merge.indexOf('.from("profiles")');
 const submissions=merge.indexOf('.from("submissions")');
 assert(role>=0&&owner>role&&profiles>owner&&submissions>owner);
 assert(merge.includes('relatedTable: data.relatedTable'));
 assert(merge.includes('relatedId: data.relatedId'));
});
test('Build86 send-time record-address binding, hard release hold and nonleaking DB diagnostics remain intact',()=>{
 const send=handler.slice(handler.indexOf('export const sendCrmEmail'),handler.indexOf('export const listEmailHistory'));
 assert(send.indexOf('assertExternalEffectReleased("crm_email")')<send.indexOf('sendEmail({'));
 assert(send.includes('isCrmEmailRecipientBound({'));
 assert(send.includes('memberships?.length !== 1'));
 assert(send.includes('[email_log] insert failed; review restricted server diagnostics'));
 assert(!send.includes('logError.message'));
});


test('Build86 low-level public Supabase logo fetch requires candidate privacy release before environment/network',()=>{
 const pdf=file('src/lib/resume-pdf.server.ts');
 const start=pdf.indexOf('export async function fetchLogoBuffer(');
 const end=pdf.indexOf('function drawSectionHeading(',start);
 const fetcher=pdf.slice(start,end);
 const hold=fetcher.indexOf('assertExternalEffectReleased("candidate_ai_processing")');
 const env=fetcher.indexOf('process.env.SUPABASE_URL');
 const net=fetcher.indexOf('downloadRemoteBounded(');
 assert(hold>0&&env>hold&&net>env);
 assert(fetcher.includes('isTrustedSupabaseLogoUrl(logoUrl, projectUrl)'));
 assert(fetcher.includes('maxRedirects: 0'));
});
test('Build86 no public careers errors expose PostgREST SQL diagnostics or candidate insert internals',()=>{
 const careers=file('src/lib/careers.functions.ts');
 const list=careers.slice(careers.indexOf('export const listOpenJobs'),careers.indexOf('export const getJobDetail'));
 const detail=careers.slice(careers.indexOf('export const getJobDetail'),careers.indexOf('const applicationSchema'));
 const apply=careers.slice(careers.indexOf('export const submitJobApplication'));
 assert(!list.includes('throw new Error(error.message)'));
 assert(!detail.includes('throw new Error(error.message)'));
 assert(!apply.includes('throw new Error(createError.message)'));
 assert(!apply.includes('throw new Error(subError.message)'));
 assert(list.includes('Career postings are temporarily unavailable.'));
 assert(apply.includes('Application could not be completed securely.'));
 assert(list.includes('assertExternalEffectReleased("careers_publication")'));
 assert(apply.includes('assertExternalEffectReleased("public_application")'));
});
