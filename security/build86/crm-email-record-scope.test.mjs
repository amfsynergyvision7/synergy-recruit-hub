import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCrmEmailRecordReadable} from '../../src/lib/crm-email-recipient-policy.ts';
import {requireVerifiedApplicantProofId,parseAtomicApplicationOutcome,normalizeSafePublicResumeUrl} from '../../src/lib/public-application-identity.ts';

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

test('Build105 source-shaped trigger rehearsal is disposable and preserves both public applicant holds',()=>{
 const composer=file('security/build105/compose-source-shaped-public-application.mjs');
 const tests=file('security/build105/verified-application-source-trigger.tests.sql');
 const snapshot=file('security/build105/production-submission-trigger.snapshot.sql');
 const source=file('security/build44/production-trigger-compat.integration.sql');
 assert(composer.includes("security/build44/production-trigger-compat.integration.sql"));
 assert(composer.includes("security/build105/production-submission-trigger.snapshot.sql"));
 assert(composer.includes("security/build104/verified-public-application.review-only.sql"));
 assert(composer.includes("security/build105/verified-application-source-trigger.tests.sql"));
 assert(composer.includes("const boundary='CREATE SCHEMA crm_private;'"));
 assert(composer.includes("assert(!prefix.includes('ROLLBACK;')"));
 assert(composer.includes("writeFileSync(output"));
 assert(source.includes('CREATE TRIGGER trg_candidate_stage_change'));
 assert(source.includes('CREATE OR REPLACE FUNCTION public.run_workflow_rules()'));
 assert(snapshot.includes('CREATE OR REPLACE FUNCTION public.normalize_submission_relationships()'));
 assert(snapshot.includes('CREATE OR REPLACE FUNCTION public.on_submission_insert()'));
 assert(snapshot.includes('CREATE TRIGGER normalize_submissions_relationships_trigger'));
 assert(snapshot.includes('CREATE TRIGGER submissions_stage_trigger'));
 assert(snapshot.includes('CREATE TRIGGER workflow_rules_trigger'));
 assert(tests.includes("c.stage IS DISTINCT FROM 'submitted_to_client'"));
 assert(tests.includes("public.candidate_stage_history WHERE candidate_id=c.id"));
 assert(tests.includes("CREATE TRIGGER zz_b105_fail AFTER INSERT ON public.submissions"));
 assert(tests.includes("SIMULATE_FAILURE"));
 assert(tests.includes("crm_private.verified_public_applications WHERE consumed_at IS NOT NULL"));
 assert(tests.trim().endsWith('ROLLBACK;'));
 const handler=file('src/lib/careers.functions.ts');
 assert(handler.includes('assertExternalEffectReleased("careers_publication")'));
 assert(handler.includes('assertExternalEffectReleased("public_application")'));
 assert(!handler.includes('.from("submissions")'));
 assert(!handler.includes('.from("candidates")'));
});

test('Build106 concurrent public application race harness preserves source-derived triggers, atomics and safe cleanup',()=>{
 const shell=file('security/build106/run-concurrent-application.sh');
 const composer=file('security/build106/compose-concurrent-application.mjs');
 const verify=file('security/build106/verify-concurrent-application.sql');
 const source=file('security/build104/verified-public-application.review-only.sql');
 const workflow=file('.github/workflows/security-build34-review.yml');
 assert(shell.includes('createdb -T template0'));
 assert(shell.includes('dropdb --if-exists --force'));
 assert(shell.includes('DROP ROLE IF EXISTS anon, authenticated, service_role'));
 assert(shell.includes('trap cleanup EXIT'));
 assert(shell.includes('pair same_proof'));
 assert(shell.includes('pair same_email'));
 assert(shell.includes('pair same_phone'));
 assert(shell.includes('verify-concurrent-application.sql'));
 assert(composer.includes('security/build44/production-trigger-compat.integration.sql')===false);
 assert(composer.includes('/tmp/amf-build105-source-trigger-rehearsal.sql'));
 assert(composer.includes("const marker='-- Build105 synthetic"));
 assert(composer.includes("assert(!baseline.includes('ROLLBACK;')"));
 assert(composer.includes('CREATE TRIGGER b106_test_delay_candidate'));
 assert(composer.includes('COMMIT;'));
 assert(verify.includes('v_candidate_count<>3'));
 assert(verify.includes('v_submission_count<>3'));
 assert(verify.includes('v_history_count<>3'));
 assert(verify.includes('v_consumed_count<>3'));
 assert(verify.includes('HAVING count(*)>1'));
 assert(verify.includes("Build106 FAIL: distinct proofs sharing email"));
 assert(verify.includes("Build106 FAIL: distinct proofs sharing phone"));
 assert(source.includes('FOR UPDATE'));
 assert(source.includes('pg_advisory_xact_lock'));
 assert(workflow.includes('  build106-concurrent-verified-applications:'));
 assert(workflow.includes('bash security/build106/run-concurrent-application.sh'));
 assert(workflow.includes('expected_substantive_jobs": 35'));
 assert(workflow.includes('  production-release-hold:'));
 const careers=file('src/lib/careers.functions.ts');
 assert(careers.includes('assertExternalEffectReleased("public_application")'));
 assert(careers.includes('assertExternalEffectReleased("careers_publication")'));
});

test('Build107 workflow notification side effects commit only with accepted application and roll back on failure',()=>{
 const stage=file('security/build105/verified-application-source-trigger.tests.sql');
 const concurrency=file('security/build106/compose-concurrent-application.mjs');
 const verify=file('security/build106/verify-concurrent-application.sql');
 const source=file('security/build44/production-trigger-compat.integration.sql');
 assert(source.includes('CREATE OR REPLACE FUNCTION public.run_workflow_rules()'));
 assert(stage.includes('Build107 synthetic stage notification'));
 assert(stage.includes("INSERT INTO public.workflow_rules("));
 assert(stage.includes("table_name,field_name,field_value,action_type,notify_target"));
 assert(stage.includes("'candidates','stage','submitted_to_client','notify','assigned_recruiter'"));
 assert(stage.includes("FROM public.notifications"));
 assert(stage.includes("Build107 FAIL: failing application left candidate/submission/history/notification/proof side effects"));
 assert(stage.includes('ROLLBACK;'));
 assert(concurrency.includes('Build107 synthetic notification'));
 assert(concurrency.includes("'candidates','stage','submitted_to_client','notify','assigned_recruiter'"));
 assert(verify.includes("Build107 FAIL: concurrent claims sent missing/duplicate recruiter notifications"));
 assert(verify.includes("Build107 FAIL: losing concurrent claims left orphan recruiter notifications"));
 assert(verify.includes("FROM public.notifications n"));
 assert(!verify.includes('DELETE FROM public.notifications'));
 const workflow=file('.github/workflows/security-build34-review.yml');
 assert(workflow.includes('  build105-source-shaped-public-application:'));
 assert(workflow.includes('  build106-concurrent-verified-applications:'));
});

test('Build108 resume URL accepts ordinary public HTTPS links and rejects executable or local URLs',()=>{
 const valid=[
   'https://drive.google.com/file/d/fictional/view?usp=sharing',
   'https://www.dropbox.com/s/fictional/resume.pdf?dl=0',
   'https://example.org/cv.pdf',
 ];
 for(const value of valid)
   assert.equal(normalizeSafePublicResumeUrl(value),value);
 for(const missing of [null,undefined,'', '   '])
   assert.equal(normalizeSafePublicResumeUrl(missing),null);
 for(const input of [
  'javascript:alert(document.domain)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'ftp://docs.google.com/resume.pdf',
  'http://docs.google.com/resume.pdf',
  'https://localhost/resume.pdf',
  'https://127.0.0.1/resume.pdf',
  'https://192.168.0.1/resume.pdf',
  'https://user:password@drive.google.com/file',
  'https://drive.google.com:8443/file',
  'https://drive.google.com:443/file',
  'https://drive.google.com./file',
  'https://internal.local/file',
  'https://example.internal/file',
  'https://remote.invalid/file',
  'https://drive.google.com.evil.invalid/file',
  'https://example.onion/file',
  'https://[::1]/file',
  'https://drive.google.com\\evil.invalid/file',
  'https://drive.google.com/resume\n.pdf',
  'https://drive.google.com/'+'a'.repeat(2100),
  {},42,[],
 ]){
   assert.throws(()=>normalizeSafePublicResumeUrl(input),/could not be completed securely/);
 }
 const server=file('src/lib/careers.functions.ts');
 const start=server.indexOf('export const submitJobApplication');
 const apply=server.slice(start);
 assert(apply.indexOf('assertExternalEffectReleased("public_application")')>=0);
 const proof=apply.indexOf('requireVerifiedApplicantProofId(data.verificationId)');
 const url=apply.indexOf('normalizeSafePublicResumeUrl(data.resumeUrl)');
 const rpc=apply.indexOf('.rpc(');
 assert(proof>=0&&url>proof&&rpc>url);
 assert(apply.includes('p_resume_url: resumeUrl'));
 assert(!apply.includes('p_resume_url: data.resumeUrl || null'));
 const sql=file('security/build104/verified-public-application.review-only.sql');
 assert(sql.includes("p_resume_url !~* '^https://"));
 assert(sql.includes('p_resume_url LIKE'));
 assert(sql.includes("RETURNS text"));
 assert(sql.includes('SECURITY DEFINER SET search_path = pg_catalog'));
 assert(!sql.includes('CREATE OR REPLACE FUNCTION public.crm_commit_verified_public_application'));
});
