import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCrmEmailRecordReadable} from '../../src/lib/crm-email-recipient-policy.ts';
import {requireVerifiedApplicantProofId,parseAtomicApplicationOutcome} from '../../src/lib/public-application-identity.ts';

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


test('Build104 public applicant proof requires a random UUIDv4, never a contact string',()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
 assert.equal(requireVerifiedApplicantProofId(id),id);
 const invalid=[null,undefined,'person@example.invalid','+91 9876543210','',
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-0aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/../',{},[],42];
 for(const item of invalid)
  assert.throws(()=>requireVerifiedApplicantProofId(item),/requires independent identity verification/);
 assert.deepEqual(parseAtomicApplicationOutcome('accepted'),{alreadyApplied:false});
 assert.deepEqual(parseAtomicApplicationOutcome('already_applied'),{alreadyApplied:true});
 for(const item of [null,{},[],{candidateId:'private-id'},'private-candidate-id','approved',false]){
  assert.throws(()=>parseAtomicApplicationOutcome(item),/could not be completed securely/);
 }
});
test('Build104 public server never issues verification proofs, reuses contacts, or writes candidate/submission rows',()=>{
 const src=file('src/lib/careers.functions.ts');
 const apply=src.slice(src.indexOf('export const submitJobApplication'));
 const hold=apply.indexOf('assertExternalEffectReleased("public_application")');
 const proof=apply.indexOf('requireVerifiedApplicantProofId(data.verificationId)');
 const rpc=apply.indexOf('.rpc(');
 assert(hold>=0&&proof>hold&&rpc>proof);
 assert(apply.includes('"crm_commit_verified_public_application"'));
 assert(apply.includes('p_proof_id: proofId'));
 assert(apply.includes('p_email: data.email'));
 assert(apply.includes('p_mobile: data.mobile'));
 assert(apply.includes('return parseAtomicApplicationOutcome(outcome)'));
 assert(!apply.includes('.from("candidates")'));
 assert(!apply.includes('.from("submissions")'));
 assert(!apply.includes('.from("notifications")'));
 assert(!apply.includes('candidateId = byEmail.id'));
 assert(!apply.includes('mobileMatches'));
 assert(!apply.includes('throw new Error(error.message)'));
 assert(!apply.includes('return { candidateId:'));
 const schema=src.slice(src.indexOf('const applicationSchema'),src.indexOf('export const submitJobApplication'));
 assert(schema.includes('verificationId: z.string().uuid().optional()'));
});
test('Build104 atomic review SQL has private proof table, explicit service-only EXECUTE, verified identity and transactional writes',()=>{
 const sql=file('security/build104/verified-public-application.review-only.sql');
 assert(sql.includes('SECURITY DEFINER SET search_path = pg_catalog'));
 assert(sql.includes('REVOKE ALL ON FUNCTION public.crm_commit_verified_public_application('));
 assert(sql.includes('FROM PUBLIC,anon,authenticated;'));
 assert(sql.includes('GRANT EXECUTE ON FUNCTION public.crm_commit_verified_public_application('));
 assert(sql.includes('TO service_role;'));
 assert(sql.includes('REVOKE ALL ON TABLE crm_private.verified_public_applications FROM PUBLIC,anon,authenticated,service_role'));
 assert(sql.includes('FOR UPDATE'));
 assert(sql.includes('v_proof.verified_email IS DISTINCT FROM v_email'));
 assert(sql.includes('v_proof.verified_mobile IS DISTINCT FROM v_phone'));
 assert(sql.includes('IF v_proof.consumed_at IS NOT NULL THEN'));
 assert(sql.includes("RETURN 'already_applied'"));
 const candidate=sql.indexOf('INSERT INTO public.candidates(');
 const submission=sql.indexOf('INSERT INTO public.submissions(');
 const consumed=sql.indexOf('UPDATE crm_private.verified_public_applications');
 assert(candidate>0&&submission>candidate&&consumed>submission);
 assert(!sql.includes('CREATE OR REPLACE FUNCTION'));
 assert(!sql.includes('GRANT EXECUTE ON FUNCTION public.crm_commit_verified_public_application(\n  uuid,uuid,text,text,text,text,numeric,numeric,text,text,text\n) TO anon'));
 const rehearsal=file('security/build104/verified-public-application.integration.sql');
 assert(rehearsal.includes('\\ir verified-public-application.review-only.sql'));
 assert(rehearsal.includes('simulated submissions trigger failure'));
 assert(rehearsal.trim().endsWith('ROLLBACK;'));
});
