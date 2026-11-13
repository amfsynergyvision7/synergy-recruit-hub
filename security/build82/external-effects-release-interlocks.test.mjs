import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertExternalEffectReleased,isExternalEffectPaused} from '../../src/lib/external-effects-hold.server.ts';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const holds=read('src/lib/external-effects-hold.server.ts');
const email=read('src/lib/email.functions.ts');
const smtp=read('src/lib/email.server.ts');
const schedule=read('src/lib/scheduling.functions.ts');
const careers=read('src/lib/careers.functions.ts');

for(const action of ['crm_email','interview_scheduling','public_application','careers_publication']){
 test('Build82 blocks '+action+' without toggles',()=>{
  assert.equal(isExternalEffectPaused(action),true);
  assert.throws(()=>assertExternalEffectReleased(action),/paused/);
 });
}
test('release holds cannot be enabled through app or server environment variables',()=>{
 assert.doesNotMatch(holds,/process\.env|import\.meta\.env|localStorage/);
 assert.equal((holds.match(/RELEASE_HOLD = true as const/g)||[]).length,4);
 assert.throws(()=>assertExternalEffectReleased('unknown'),/Unapproved/);
});
test('CRM mail is held before SMTP and logs; email history is restricted to approved role',()=>{
 const send=email.slice(email.indexOf('export const sendCrmEmail'),email.indexOf('export const listEmailHistory'));
 assert(send.indexOf('assertExternalEffectReleased("crm_email")')>=0);
 assert(send.indexOf('assertExternalEffectReleased("crm_email")')<send.indexOf('sendEmail({'));
 assert(send.includes('await assertApprovedRole(context.userId, ["admin", "recruiter"])'));
 assert(!send.includes('roles ?? []).some('));
 assert.equal((email.slice(email.indexOf('export const listEmailHistory')).match(/await assertApprovedRole\(context\.userId, \["admin", "recruiter"\]\)/g)||[]).length,2);
 assert(smtp.indexOf('if (isExternalEffectPaused("crm_email"))')<smtp.indexOf('const user = process.env.SMTP_USER'));
 assert(!smtp.includes('err?.message'));
});
test('scheduling handles block before DB and use unique approved role where applicable',()=>{
 const first=schedule.slice(schedule.indexOf('export const createSchedulingLink'),schedule.indexOf('export const getSchedulingInfo'));
 const info=schedule.slice(schedule.indexOf('export const getSchedulingInfo'),schedule.indexOf('export const confirmSchedulingSlot'));
 const confirm=schedule.slice(schedule.indexOf('export const confirmSchedulingSlot'));
 for(const section of [first,info,confirm]){
  const gate=section.indexOf('assertExternalEffectReleased("interview_scheduling")');
  assert(gate>=0 && gate<section.indexOf('.from("interviews")'));
 }
 assert(first.includes('await assertApprovedRole(context.userId, ["admin", "recruiter"])'));
 assert(!first.includes('roles ?? []).some('));
});
test('public scheduling token confirmation uses database-side atomic CAS to prevent stale overwrites',()=>{
 const confirm=schedule.slice(schedule.indexOf('export const confirmSchedulingSlot'));
 assert.match(confirm,/\.eq\("id", interview\.id\)\s*\.eq\("status", "awaiting_candidate"\)\s*\.contains\("proposed_slots", \[data\.slot\]\)\s*\.select\("id"\)\s*\.maybeSingle\(\)/);
 assert(confirm.indexOf('if (updateError || !confirmed)')<confirm.indexOf('from("notifications")'));
});
test('public careers publication and application side effects are blocked before privileged reads or writes',()=>{
 const list=careers.slice(careers.indexOf('export const listOpenJobs'),careers.indexOf('export const getJobDetail'));
 const detail=careers.slice(careers.indexOf('export const getJobDetail'),careers.indexOf('const applicationSchema'));
 const apply=careers.slice(careers.indexOf('export const submitJobApplication'));
 for(const section of [list,detail,apply]){
  const gate=section.indexOf('assertExternalEffectReleased(');
  assert(gate>=0 && gate<section.indexOf('supabaseAdmin'));
 }
 assert(list.includes('assertExternalEffectReleased("careers_publication")'));
 assert(detail.includes('assertExternalEffectReleased("careers_publication")'));
 assert(apply.includes('assertExternalEffectReleased("public_application")'));
 assert.match(detail,/\.eq\("id", data\.jobId\)\s*\.eq\("status", "open"\)/);
 assert(!detail.includes('error.message'));
});
