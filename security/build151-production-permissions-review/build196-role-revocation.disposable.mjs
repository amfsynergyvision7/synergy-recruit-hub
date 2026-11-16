/**
 * Build196 — previously issued legitimate GoTrue token vs server-side role
 * revocation and profile approval changes. Synthetic users and rows ONLY.
 * The 35 actual PR16 RLS policies + PR23 helper remain unchanged.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

function psqlInDisposable(sql){
 const e=process.env;
 assert(e.B195_DISPOSABLE_ONLY==='true'&&e.PGHOST==='127.0.0.1'&&
 e.PGDATABASE==='amf_build195_gotrue_35_policy_lab'&&
 e.PGUSER==='postgres'&&e.PGPASSWORD==='synthetic-disposable-only',
 'Build196 refuses non-ephemeral database changes');
 const guard=[
 "DO $guard$ BEGIN IF current_database()<>'amf_build195_gotrue_35_policy_lab'",
 " OR session_user<>'postgres' THEN",
 " RAISE EXCEPTION 'Build196 non-disposable target refused'; END IF; END $guard$;"
 ].join('\n');
 const out=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-c',guard+'\n'+sql],
  {encoding:'utf8',env:e,timeout:15000});
 assert.equal(out.status,0,'Build196 synthetic permission update: '+String(out.stderr).slice(0,350));
}
function safeUuid(input){
 assert.match(input,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
 return "'"+input+"'::uuid";
}
export async function runBuild196({uids,query,rpc,mutation,yes}){
 assert(uids?.recruiterA);
 const own=safeUuid(uids.recruiterA),actor='recruiterA';
 const candidate=()=>query(actor,'candidates');
 const job=()=>query(actor,'job_openings');
 const role=()=>rpc(actor,uids.recruiterA,'recruiter');
 const insert=(id)=>mutation(actor,'POST','candidates',{
  id,assigned_recruiter:uids.recruiterA,stage:'lead_received'
 });
 // JWT stays exactly the SAME, but the database role record changes.
 psqlInDisposable('DELETE FROM public.user_roles WHERE user_id='+own+" AND role='recruiter'::public.app_role;");
 const self=await query(actor,'profiles');
 yes('B196_REVOKED_BUT_JWT_STILL_VALID_SELF_PROFILE',self.status===200&&self.count===1,self);
 const afterRole=await candidate();
 yes('B196_REVOKED_CANDIDATES_INVISIBLE',afterRole.status===200&&afterRole.count===0,afterRole);
 const afterJobs=await job();
 yes('B196_REVOKED_JOBS_INVISIBLE',afterJobs.status===200&&afterJobs.count===0,afterJobs);
 const afterSubs=await query(actor,'submissions');
 yes('B196_REVOKED_SUBMISSIONS_INVISIBLE',afterSubs.status===200&&afterSubs.count===0,afterSubs);
 const afterNotifications=await query(actor,'notifications');
 yes('B196_ORIGINAL_DRAFT_ROLELESS_NOTIFICATION_GAP_REPRODUCED',
   afterNotifications.status===200&&afterNotifications.count===1,afterNotifications);
 console.log('BUILD196_RELEASE_HOLD_ORIGINAL_NOTIFICATION_POLICY_ALLOWS_ROLE_REVOKED_RECIPIENT');

 // Candidate NOT approved for release: apply review-only ALTER POLICY exclusively
 // to disposable DB after the original policy gap has been reproduced.
 const overlay=readFileSync(new URL('./build196-notification-role-required.REVIEW-ONLY.sql.txt',import.meta.url),'utf8');
 assert.match(overlay,/ALTER POLICY notifications_read/);
 assert.match(overlay,/EXISTS\s*\(/);
 psqlInDisposable(overlay);
 const validator=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-f',
   'security/build151-production-permissions-review/build192-exact-35-policy-fingerprint.readonly.sql'],
   {encoding:'utf8',env:process.env,timeout:15000});
 assert.equal(validator.status,0);
 assert.match(validator.stdout,/HOLD_PROPOSED_35_POLICY_SOURCE_OR_PREDICATE_DRIFT/);
 console.log('BUILD196_CANDIDATE_POLICY_DIVERGES_FROM_REVIEWED_35_POLICY_SOURCE_HOLD');
 const patchedNotifications=await query(actor,'notifications');
 yes('B196_REVIEW_ONLY_PATCH_REVOKED_NOTIFICATIONS_DENIED',
   patchedNotifications.status===200&&patchedNotifications.count===0,patchedNotifications);
 const afterUserRole=await query(actor,'user_roles');
 yes('B196_REVOKED_ROLE_RECORD_ABSENT',afterUserRole.status===200&&afterUserRole.count===0,afterUserRole);
 const ownRole=await role();
 yes('B196_REVOKED_HELPER_FALSE',ownRole.status===200&&ownRole.result===false,ownRole);
 const foreign=await rpc(actor,uids.admin,'admin');
 yes('B196_REVOKED_CANNOT_PROBE_ADMIN_ROLE',foreign.status===200&&foreign.result===false,foreign);
 const blocked=await insert('c1000000-0000-4000-8000-000000000005');
 yes('B196_REVOKED_CANDIDATE_WRITE_DENIED',[401,403].includes(blocked.status),blocked);
 console.log('BUILD196_REVOKED_UNEXPIRED_GOTRUE_JWT_ACCESS_CUT_OFF');

 // Restore role while retaining the same JWT. Do not rely on token claims
 // containing a stale role; DB membership must immediately take effect.
 psqlInDisposable("INSERT INTO public.user_roles(id,user_id,role) VALUES("+
 "'a1000000-0000-4000-8000-000000000010'::uuid,"+own+",'recruiter'::public.app_role);");
 const again=await role();
 yes('B196_REGRANTED_ROLE_HELPER_TRUE',again.status===200&&again.result===true,again);
 const ownRows=await candidate();
 yes('B196_REGRANTED_OWN_CANDIDATES_REAPPEAR',ownRows.status===200&&ownRows.count===2,ownRows);
 const againJobs=await job();
 yes('B196_REGRANTED_OWN_JOB_REAPPEARS',againJobs.status===200&&againJobs.count===1,againJobs);

 // A role can remain present while HR/compliance disables the profile.
 psqlInDisposable("UPDATE public.profiles SET is_active=false WHERE id="+own+';');
 const stillRole=await role();
 yes('B196_INACTIVE_ROLE_LOOKUP_TRUE_NOT_AUTHORIZATION',stillRole.status===200&&stillRole.result===true,stillRole);
 const inactiveRows=await candidate();
 yes('B196_INACTIVE_APPROVAL_BLOCKS_CANDIDATES',inactiveRows.status===200&&inactiveRows.count===0,inactiveRows);
 const inactiveJobs=await job();
 yes('B196_INACTIVE_APPROVAL_BLOCKS_JOBS',inactiveJobs.status===200&&inactiveJobs.count===0,inactiveJobs);
 const inactiveNotifications=await query(actor,'notifications');
 yes('B196_INACTIVE_APPROVAL_BLOCKS_NOTIFICATIONS',
  inactiveNotifications.status===200&&inactiveNotifications.count===0,inactiveNotifications);
 const inactiveSelf=await query(actor,'profiles');
 yes('B196_INACTIVE_CAN_STILL_READ_SELF_PROFILE',
  inactiveSelf.status===200&&inactiveSelf.count===1,inactiveSelf);
 const inactiveInsert=await insert('c1000000-0000-4000-8000-000000000006');
 yes('B196_INACTIVE_CANDIDATE_WRITE_DENIED',[401,403].includes(inactiveInsert.status),inactiveInsert);

 psqlInDisposable("UPDATE public.profiles SET is_active=true WHERE id="+own+';');
 const reactivated=await candidate();
 yes('B196_REACTIVATED_CANDIDATES_REAPPEAR',
 reactivated.status===200&&reactivated.count===2,reactivated);

 // Approval status revoke is independent of role membership and active flag.
 psqlInDisposable("UPDATE public.profiles SET status='suspended'::public.user_status WHERE id="+own+';');
 const suspended=await candidate();
 yes('B196_SUSPENDED_CANDIDATES_INVISIBLE',suspended.status===200&&suspended.count===0,suspended);
 const suspendedSubs=await query(actor,'submissions');
 yes('B196_SUSPENDED_SUBMISSIONS_INVISIBLE',suspendedSubs.status===200&&suspendedSubs.count===0,suspendedSubs);
 const suspendedRole=await role();
 yes('B196_SUSPENDED_ROLE_LOOKUP_TRUE_BUT_DATA_DENIED',
 suspendedRole.status===200&&suspendedRole.result===true,suspendedRole);
 psqlInDisposable("UPDATE public.profiles SET status='approved'::public.user_status WHERE id="+own+';');
 const final=await candidate();
 yes('B196_REAPPROVED_CANDIDATES_RECOVER',final.status===200&&final.count===2,final);

 console.log('BUILD196_24_OF_24_ORIGINAL_GAP_AND_REVIEW_OVERLAY_CASES_PASS_DISPOSABLE_ONLY');
}
