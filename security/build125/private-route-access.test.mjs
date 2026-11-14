import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 CANDIDATE_AI_BROWSER_RELEASE_HOLD,
 canReadPrivateUserDirectory,
 canReadCandidateActivityMetadata,
 canUseCandidateAiMatching,
} from "../../src/lib/crm-sensitive-route-access.ts";
const src=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const approved={id:"auth-a",status:"approved",is_active:true};
test("Build125 approved admin can read private directory metadata",()=>{
 assert.equal(canReadPrivateUserDirectory("auth-a",approved,"admin"),true);
 assert.equal(canReadCandidateActivityMetadata("auth-a",approved,"admin"),true);
});
test("Build125 ordinary approved roles can never read the full user directory",()=>{
 for(const role of ["viewer","recruiter","operations","finance",null,"guest"])
  assert.equal(canReadPrivateUserDirectory("auth-a",approved,role),false,role);
});
test("Build125 candidate activity timeline is restricted to admin, not a universal feed",()=>{
 for(const role of ["viewer","recruiter","operations","finance",null,"guest"])
  assert.equal(canReadCandidateActivityMetadata("auth-a",approved,role),false,role);
});
test("Build125 identity mismatch or missing account denies all private directory reads",()=>{
 for(const id of [null,undefined,"","auth-b"])
  assert.equal(canReadPrivateUserDirectory(id,approved,"admin"),false);
});
test("Build125 revoked, suspended, pending or inactive profiles lose admin rights",()=>{
 for(const status of ["suspended","pending","rejected",null,""]){
  assert.equal(canReadPrivateUserDirectory("auth-a",{...approved,status},"admin"),false);
  assert.equal(canReadCandidateActivityMetadata("auth-a",{...approved,status},"admin"),false);
 }
 assert.equal(canReadPrivateUserDirectory("auth-a",{...approved,is_active:false},"admin"),false);
});
test("Build125 missing profile, spoofed role or profile ID fails closed",()=>{
 assert.equal(canReadPrivateUserDirectory("auth-a",null,"admin"),false);
 assert.equal(canReadPrivateUserDirectory("auth-a",{...approved,id:"auth-b"},"admin"),false);
 assert.equal(canReadPrivateUserDirectory("auth-a",approved,"Admin"),false);
});
test("Build125 AI browser side effects are held for every identity and role",()=>{
 assert.equal(CANDIDATE_AI_BROWSER_RELEASE_HOLD,true);
 for(const role of ["admin","recruiter","operations","viewer","finance",null])
  assert.equal(canUseCandidateAiMatching("auth-a",approved,role),false,role);
});
test("Build125 AI browser hold cannot be reopened by build flags or browser storage",()=>{
 const policy=src("src/lib/crm-sensitive-route-access.ts");
 for(const forbidden of ["process.env","import.meta.env","localStorage","sessionStorage","window.location"])
  assert(!policy.includes(forbidden),forbidden);
 assert(policy.includes("CANDIDATE_AI_BROWSER_RELEASE_HOLD = true"));
});
test("Build125 private directory performs no query until approved administrator",()=>{
 const view=src("src/routes/_app.users.tsx");
 assert(view.includes("canReadPrivateUserDirectory(user?.id, profile, role)"));
 assert(view.includes("if (!allowed) return () => { active = false; controller.abort(); };"));
 assert(view.includes("if (!allowed)"));
 assert(view.includes("User directory access requires a verified administrator account."));
});
test("Build125 user directory fetch is strictly column limited and not wildcard",()=>{
 const s=src("src/routes/_app.users.tsx");
 assert(s.includes('.select("id, full_name, email, department, status, is_active, created_at", { count: "exact" })'));
 assert(s.includes('.select("user_id, role", { count: "exact" })'));
 assert(!s.includes('.select("*")'));
});
test("Build125 private directory rejects truncation and missing count metadata",()=>{
 const s=src("src/routes/_app.users.tsx");
 assert(s.includes("!Number.isSafeInteger(profileCount)"));
 assert(s.includes("!Number.isSafeInteger(roleCount)"));
 assert(s.includes("profileCount! > 200"));
 assert(s.includes("roleCount! > 200"));
 assert(s.includes("profs.length !== profileCount"));
 assert(s.includes("roles.length !== roleCount"));
});
test("Build125 ambiguous multiple roles or stale auth fetches cannot silently present data",()=>{
 const s=src("src/routes/_app.users.tsx");
 assert(s.includes("if (roleMap.has(item.user_id))"));
 assert(s.includes("controller.abort()"));
 assert(s.includes("if (!active || controller.signal.aborted) return;"));
 assert(s.includes("setUsers([]);"));
 assert(s.includes("setLoadFailed(true)"));
});
test("Build125 suspended admin cannot trigger mutation callbacks or see directory",()=>{
 const s=src("src/routes/_app.users.tsx");
 assert(s.includes("const isAdmin = allowed;"));
 assert(s.includes("const canManageUsers = isAdmin && CRM_USER_ADMIN_MUTATIONS_ENABLED"));
 assert(s.includes("if (!canManageUsers)"));
 assert(s.includes("CRM_USER_ADMIN_MUTATIONS_ENABLED"));
});
test("Build125 user administration never prints raw backend error messages",()=>{
 const s=src("src/routes/_app.users.tsx");
 assert(!s.includes("toast.error(error.message)"));
 assert(!s.includes("console.error(error)"));
 assert(s.includes('toast.error("Account change unavailable.")'));
});
test("Build125 activity timeline requires approved admin before Supabase requests",()=>{
 const s=src("src/routes/_app.activities.tsx");
 assert(s.includes("canReadCandidateActivityMetadata(user?.id, profile, role)"));
 assert(s.includes("if (!allowed) return () => { active = false; controller.abort(); };"));
 assert(s.includes("Candidate activity metadata requires administrator access."));
});
test("Build125 activity timeline selects only action/time/module, no candidate notes or names",()=>{
 const s=src("src/routes/_app.activities.tsx");
 assert(s.includes('.select("id, created_at, action_type, module_created", { count: "exact" })'));
 assert(s.includes("readCompleteCrmRows(async (from, to, signal) =>"));
 assert(s.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 for(const forbidden of ['.select("*")','r.notes','r.candidate_name','r.recruiter_name','r.user_email'])
  assert(!s.includes(forbidden),forbidden);
});
test("Build125 activity timeline no longer opens unrestricted all-candidate realtime channels",()=>{
 const s=src("src/routes/_app.activities.tsx");
 assert(!s.includes('.on("postgres_changes"'));
 assert(!s.includes('supabase.channel('));
 assert(s.includes("controller.abort()"));
 assert(s.includes("setRows(sortCompleteCrmRows(data, \"created_at\", false))"));
 assert(s.includes("setRows([]); setFailed(true);"));
 assert(s.includes("{!rows.length && !failed && ("));
});
test("Build125 sidebar hides directory, timeline and AI matching under same exact policies",()=>{
 const s=src("src/components/AppSidebar.tsx");
 for(const f of ["canReadPrivateUserDirectory","canReadCandidateActivityMetadata","canUseCandidateAiMatching"])
  assert(s.includes(f+"(user?.id, profile, role)"));
 assert(s.includes("shownItems.map((item)"));
});
test("Build125 server deep-match response excludes raw resume/candidate/job records",()=>{
 const s=src("src/lib/ai.functions.ts");
 const fn=s.slice(s.indexOf("export const matchCandidateWithResume"),s.indexOf("export const generateCandidateResumeSummary"));
 assert(fn.includes('assertExternalEffectReleased("candidate_ai_processing")'));
 assert(fn.includes("await assertApprovedRole(context.userId"));
 assert(fn.includes("const { match } = await matchCandidateResume("));
 assert(fn.includes("return { match };"));
 assert(!fn.includes("return matchCandidateResume("));
});
test("Build125 AI page prevents any real provider/job read while browser hold active",()=>{
 const s=src("src/routes/_app.ai-match.tsx");
 assert(s.includes("if (!canUseCandidateAiMatching(user?.id, profile, role))"));
 assert(s.includes("Candidate AI processing is paused"));
 assert(s.includes("return <AiMatchingWorkspace key={user?.id} />"));
 assert(!s.includes("deep.resumeText"));
 assert(!s.includes("showResumeText"));
});
test("Build125 deep match error does not show raw external provider or file exception",()=>{
 const s=src("src/routes/_app.ai-match.tsx");
 assert(!s.includes("deepMut.error as any"));
 assert(!s.includes("toast.error(error.message)"));
 assert(!s.includes("onError: (err: any)"));
 assert(s.includes("No candidate details were disclosed"));
});
