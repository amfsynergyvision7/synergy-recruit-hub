import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reconcileAdminDirectory, ADMIN_DIRECTORY_MAX_RECORDS } from "../../src/lib/admin-directory-integrity.ts";
import { CRM_MAX_ROWS, readCompleteCrmRows, sortCompleteCrmRows } from "../../src/lib/bounded-crm-read.ts";
import { canReadPrivateUserDirectory } from "../../src/lib/crm-sensitive-route-access.ts";

const source=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const directory=source("src/routes/_app.users.tsx");
const audit=source("src/routes/_app.audit.tsx");
const admin=source("src/lib/user-administration.ts");
const p=(id="user-1")=>({id,full_name:"Example Admin",email:"synthetic@example.invalid",
 department:null,status:"approved",is_active:true,created_at:"2026-11-14T00:00:00Z"});
const r=(id="role-1",user_id="user-1")=>({id,user_id,role:"admin"});
const pages=rows=>async(from,to)=>({data:rows.slice(from,to+1),count:rows.length,error:null});
const many=(n,prop="user")=>Array.from({length:n},(_,i)=>({id:prop+"-"+String(i).padStart(5,"0")}));

test("Build134 identity boundary allows only current approved active administrator",()=>{
 const approved={id:"user-1",status:"approved",is_active:true};
 assert.equal(canReadPrivateUserDirectory("user-1",approved,"admin"),true);
 for(const role of ["recruiter","viewer","operations","finance",null])
  assert.equal(canReadPrivateUserDirectory("user-1",approved,role),false);
 for(const status of ["pending","rejected","suspended"])
  assert.equal(canReadPrivateUserDirectory("user-1",{...approved,status},"admin"),false);
 assert.equal(canReadPrivateUserDirectory("different",approved,"admin"),false);
});

test("Build134 exact complete profile and role join preserves a valid assignment",()=>{
 assert.deepEqual(reconcileAdminDirectory([p()],[r()]),[{...p(),role:"admin"}]);
});

test("Build134 approved profile without a role remains visibly unassigned",()=>{
 assert.deepEqual(reconcileAdminDirectory([p()],[]),[{...p(),role:"unassigned"}]);
});

test("Build134 duplicate roles for the same user fail rather than choosing last",()=>{
 assert.throws(()=>reconcileAdminDirectory([p()],[r(),r("role-2")]),/Ambiguous or unavailable directory role/);
});

test("Build134 role referring to a non-visible profile cannot be silently ignored",()=>{
 assert.throws(()=>reconcileAdminDirectory([p()],[r("role-2","hidden-user")]),/Ambiguous or unavailable directory role/);
});

test("Build134 rejected role values cannot be presented as verified authority",()=>{
 for(const role of ["guest","superuser","",null,undefined,"Admin"])
  assert.throws(()=>reconcileAdminDirectory([p()],[{...r(),role}]),/Ambiguous or unavailable directory role/);
});

test("Build134 exact duplicate profile identity is refused",()=>{
 assert.throws(()=>reconcileAdminDirectory([p(),p()],[]),/Incomplete or ambiguous directory profile/);
});

test("Build134 empty and malformed profile IDs are refused",()=>{
 for(const id of [""," ","\n",null,undefined,12])
  assert.throws(()=>reconcileAdminDirectory([{...p(),id}],[]),/Incomplete or ambiguous directory profile/);
});

test("Build134 malformed user names, emails, and status cannot become plausible directory users",()=>{
 for(const field of ["full_name","email"]){
  for(const value of ["",null," ",undefined])
   assert.throws(()=>reconcileAdminDirectory([{...p(),[field]:value}],[]),/Incomplete or ambiguous directory profile/);
 }
 for(const status of ["unknown","",null,undefined])
  assert.throws(()=>reconcileAdminDirectory([{...p(),status}],[]),/Incomplete or ambiguous directory profile/);
});

test("Build134 malformed is_active flag and timestamps are refused",()=>{
 for(const is_active of [null,1,"true",undefined])
  assert.throws(()=>reconcileAdminDirectory([{...p(),is_active}],[]),/Incomplete or ambiguous directory profile/);
 for(const created_at of ["",null,undefined," "])
  assert.throws(()=>reconcileAdminDirectory([{...p(),created_at}],[]),/Incomplete or ambiguous directory profile/);
});

test("Build134 no-profile empty directory is valid only if no dangling role exists",()=>{
 assert.deepEqual(reconcileAdminDirectory([],[]),[]);
 assert.throws(()=>reconcileAdminDirectory([],[r()]),/Ambiguous or unavailable directory role/);
});

test("Build134 count-complete admin profile directory handles over 200 valid rows",async()=>{
 const input=many(251);
 const out=await readCompleteCrmRows(pages(input),new AbortController().signal);
 assert.equal(out.length,251);
 assert.equal(CRM_MAX_ROWS,ADMIN_DIRECTORY_MAX_RECORDS);
});

test("Build134 exactly 2500 admin role rows are reconciled across ten pages",async()=>{
 const input=many(2500,"role");
 let calls=0;
 const out=await readCompleteCrmRows(async(from,to)=>{
  calls++;return{data:input.slice(from,to+1),count:input.length,error:null};
 },new AbortController().signal);
 assert.equal(out.length,2500);assert.equal(calls,10);
});

test("Build134 2501 directory entries fail closed rather than hiding a user",async()=>{
 const input=many(2501);
 await assert.rejects(readCompleteCrmRows(pages(input),new AbortController().signal),/exceeds verified row limit/);
});

test("Build134 changing counts reject incomplete two-table role pages",async()=>{
 const input=many(280);let calls=0;
 await assert.rejects(readCompleteCrmRows(async(from,to)=>{
  calls++;return {data:input.slice(from,to+1),count:calls===1?280:281,error:null};
 },new AbortController().signal),/changed while reading/);
});

test("Build134 request cancellation rejects stale admin account results",async()=>{
 const controller=new AbortController();
 const input=many(6);
 await assert.rejects(readCompleteCrmRows(async()=>{
  controller.abort();return {data:input,count:input.length,error:null};
 },controller.signal),/cancelled/);
});

test("Build134 stable admin directory ordering matches previous newest-first UI",()=>{
 const profiles=[{...p("a"),created_at:"2026-11-01T00:00:00Z"},
  {...p("b"),created_at:"2026-11-02T00:00:00Z"}];
 assert.deepEqual(sortCompleteCrmRows(profiles,"created_at",false).map(x=>x.id),["b","a"]);
});

test("Build134 admin directory never mounts private rows under null Auth role",()=>{
 assert(directory.includes("if (loading || !canReadPrivateUserDirectory(user?.id, profile, role))"));
 assert(directory.includes('return <VerifiedAdminDirectory key={user!.id + ":" + role} />'));
 assert(directory.includes("if (!allowed) return () => { active = false; controller.abort(); };"));
 assert(directory.includes("return () => { active = false; controller.abort(); };"));
});

test("Build134 admin role directory uses two exact-count RLS-visible paginated selectors",()=>{
 assert(directory.includes('select("id, full_name, email, department, status, is_active, created_at", { count: "exact" })'));
 assert(directory.includes('select("id, user_id, role", { count: "exact" })'));
 assert.equal((directory.match(/readCompleteCrmRows\(async \(from, to, signal\) =>/g)||[]).length,2);
 assert(directory.includes('order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(!directory.includes('.limit(200)'));
 assert(directory.includes("reconcileAdminDirectory(profs, roles)"));
 assert(!directory.includes('.select("*")'));
});

test("Build134 failed directory read is not shown as a successful empty directory",()=>{
 assert(directory.includes('loadFailed ? "Directory count unavailable"'));
 assert(directory.includes("!loading && !loadFailed && !users.length"));
 assert(directory.includes("setUsers([]);"));
 assert(directory.includes("setLoadFailed(true)"));
});

test("Build134 user administration cannot be activated by a frontend flag",()=>{
 assert(admin.includes("CRM_USER_ADMIN_MUTATIONS_ENABLED = false as const"));
 assert(!admin.includes("import.meta.env.VITE_CRM_USER_ADMIN_MUTATIONS_ENABLED"));
 assert(admin.includes("if (!CRM_USER_ADMIN_MUTATIONS_ENABLED)"));
 assert(directory.includes("const canManageUsers = isAdmin && CRM_USER_ADMIN_MUTATIONS_ENABLED"));
 for(const op of ["updateStatus","updateActive","updateRole"])
  assert(directory.includes("const "+op+" = async"));
});

test("Build134 audit records cannot mount before exact approved admin Auth",()=>{
 assert(audit.includes("if (loading || !canReadAuditLogs(user?.id, profile, role))"));
 assert(audit.includes('return <VerifiedAuditWorkspace key={user!.id + ":" + role} />'));
 assert(audit.includes("if (!allowed) return () => { active = false; controller.abort(); };"));
});

test("Build134 audit metadata read has explicit count, narrow columns and abortable pages",()=>{
 assert(audit.includes('select("id, created_at, user_id, action, table_name, record_id", { count: "exact" })'));
 assert(audit.includes("readCompleteCrmRows<AuditMetadata>("));
 assert(audit.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(!audit.includes('.limit(200)'));
 assert(!audit.includes('.select("*")'));
});

test("Build134 audit timeline 201 authorized rows never silently truncate",async()=>{
 const result=await readCompleteCrmRows(pages(many(201,"audit")),new AbortController().signal);
 assert.equal(result.length,201);
});

test("Build134 audit timeline 2501 authorized rows fail closed",async()=>{
 await assert.rejects(readCompleteCrmRows(pages(many(2501,"audit")),new AbortController().signal),/exceeds verified row limit/);
});

test("Build134 audit history never conflates read error and no audit history",()=>{
 assert(audit.includes('failed ? "Audit count unavailable"'));
 assert(audit.includes("No partial history is shown."));
 assert(audit.includes('failed ? null'));
 assert(audit.includes("setFailed(true)"));
});

test("Build134 audit read excludes before-after payloads and executes no browser writes",()=>{
 assert(!audit.includes("user_email"));
 assert(!audit.includes("details"));
 assert(!audit.includes('.insert('));
 assert(!audit.includes('.update('));
 assert(!audit.includes('.delete('));
 assert(!audit.includes('service_role'));
});

test("Build134 admin and audit views never print raw backend error messages",()=>{
 for(const s of [audit,directory]){
  assert(!s.includes("toast.error(error.message)"));
  assert(!s.includes("console.error(error)"));
 }
 assert(directory.includes('toast.error("Account change unavailable.")'));
});
