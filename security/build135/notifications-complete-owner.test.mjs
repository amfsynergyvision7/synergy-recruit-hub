import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyOwnedNotificationRows } from "../../src/lib/notifications-read-integrity.ts";
import { readCompleteCrmRows, sortCompleteCrmRows, CRM_MAX_ROWS, CRM_PAGE_SIZE } from "../../src/lib/bounded-crm-read.ts";
import { filterOwnedNotificationRows } from "../../src/lib/notification-owner.ts";
import { canMountApprovedCrm } from "../../src/lib/crm-shell-access.ts";

const page=readFileSync(new URL("../../src/routes/_app.notifications.tsx",import.meta.url),"utf8");
const sample=(n,user="user-a")=>Array.from({length:n},(_,i)=>({
 id:String(i).padStart(6,"0"),user_id:user,title:"Inert notification",
 message:null,type:"generic",is_read:false,
 created_at:new Date(1760000000000+i*1000).toISOString()
}));
const reader=records=>async(from,to)=>({data:records.slice(from,to+1),count:records.length,error:null});

test("Build135 complete owner list accepts valid empty collection",()=>{
 assert.deepEqual(verifyOwnedNotificationRows([],"user-a"),[]);
});
test("Build135 valid complete owner collection does not leak or mutate input",()=>{
 const rows=sample(2);
 const result=verifyOwnedNotificationRows(rows,"user-a");
 assert.deepEqual(result,rows);
 assert.notStrictEqual(result,rows);
});
test("Build135 invalid/blank owner subject and missing feed cannot verify",()=>{
 for(const user of [""," ",null,undefined,0])
  assert.throws(()=>verifyOwnedNotificationRows([],user),/not verified/);
 for(const value of [null,undefined,{},42,"[]"])
  assert.throws(()=>verifyOwnedNotificationRows(value,"user-a"),/not verified/);
});
test("Build135 cross-account row rejects entire feed, not silent filtered partial list",()=>{
 const rows=[...sample(2),...sample(1,"user-b")];
 assert.equal(filterOwnedNotificationRows(rows,"user-a").length,2);
 assert.throws(()=>verifyOwnedNotificationRows(rows,"user-a"),/foreign owner/);
});
test("Build135 null, missing and malformed notification IDs are refused",()=>{
 for(const id of [""," ",null,undefined,123])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],id}],"user-a"),/foreign owner/);
});
test("Build135 malformed title and created_at reject otherwise plausible records",()=>{
 for(const title of [null,undefined,42])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],title}],"user-a"),/foreign owner/);
 for(const created_at of [""," ",null,undefined,42])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],created_at}],"user-a"),/foreign owner/);
});
test("Build135 malformed message and type metadata are refused",()=>{
 for(const message of [undefined,42,{},false])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],message}],"user-a"),/foreign owner/);
 for(const type of [undefined,23,{}])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],type}],"user-a"),/foreign owner/);
});
test("Build135 boolean read status must not be inferred from truthy strings",()=>{
 for(const is_read of ["false","true",null,0,1,undefined])
  assert.throws(()=>verifyOwnedNotificationRows([{...sample(1)[0],is_read}],"user-a"),/foreign owner/);
});
test("Build135 approved account and role gate precedes feed mount",()=>{
 assert(page.includes("canMountApprovedCrm(user.id, profile, role)"));
 assert(page.includes('return <OwnedNotifications key={user.id} userId={user.id} />'));
 assert(page.indexOf("function Page()")<page.indexOf("function OwnedNotifications("));
});
test("Build135 owner-filtered notification list now requests exact counts with ID paging",()=>{
 assert(page.includes('select("id,user_id,title,message,type,is_read,created_at", { count: "exact" })'));
 assert(page.includes('.eq("user_id", userId)'));
 assert(page.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(page.includes('readCompleteCrmRows<NotificationItem>('));
 assert(!page.includes('.limit(100)'));
});
test("Build135 previously invalid 101 count is now accepted as 2 bounded pages",async()=>{
 const records=sample(101);let calls=0;
 const out=await readCompleteCrmRows(async(from,to)=>{
  calls++;return{data:records.slice(from,to+1),count:records.length,error:null};
 },new AbortController().signal);
 assert.equal(out.length,101);assert.equal(calls,1);
});
test("Build135 251 and 1001 owner notifications can be completely retrieved",async()=>{
 for(const n of [251,1001]){
  let calls=0;const records=sample(n);
  const rows=await readCompleteCrmRows(async(from,to)=>{
   calls++;return{data:records.slice(from,to+1),count:records.length,error:null};
  },new AbortController().signal);
  assert.equal(rows.length,n);
  assert.equal(calls,Math.ceil(n/CRM_PAGE_SIZE));
 }
});
test("Build135 2500 notifications pass exact ten-page complete verification",async()=>{
 const input=sample(CRM_MAX_ROWS);
 const out=await readCompleteCrmRows(reader(input),new AbortController().signal);
 assert.equal(out.length,CRM_MAX_ROWS);
 assert.equal(out.at(-1).id,"002499");
});
test("Build135 2501 notifications fail closed without a partial count or export",async()=>{
 await assert.rejects(readCompleteCrmRows(reader(sample(CRM_MAX_ROWS+1)),new AbortController().signal),/exceeds verified row limit/);
});
test("Build135 changed notification count between pages rejects entire snapshot",async()=>{
 const data=sample(300);let count=0;
 const query=async(from,to)=>({data:data.slice(from,to+1),count:++count===1?300:301,error:null});
 await assert.rejects(readCompleteCrmRows(query,new AbortController().signal),/changed while reading/);
});
test("Build135 duplicated ID at a page boundary invalidates notification feed",async()=>{
 const rows=sample(260);rows[250].id=rows[249].id;
 await assert.rejects(readCompleteCrmRows(reader(rows),new AbortController().signal),/order\/identity/);
});
test("Build135 missing server exact count never displays a misleading empty feed",async()=>{
 await assert.rejects(readCompleteCrmRows(async()=>({data:[],count:null,error:null}),new AbortController().signal),/count not verified/);
});
test("Build135 cancelled stale feed cannot return a partial result",async()=>{
 const c=new AbortController(),data=sample(15);
 await assert.rejects(readCompleteCrmRows(async()=>{c.abort();return{data,count:data.length,error:null}},c.signal),/cancelled/);
});
test("Build135 UI sorts verified complete feed newest-first after ID paging",()=>{
 const rows=sample(3);
 assert.deepEqual(sortCompleteCrmRows(rows,"created_at",false).map(r=>r.id),["000002","000001","000000"]);
 assert(page.includes('sortCompleteCrmRows('));
 assert(page.includes('"created_at", false'));
});
test("Build135 no partial notification count or zero indicator appears on errors",()=>{
 assert(page.includes('setLoadFailed(true)'));
 assert(page.includes('"Notification list unavailable"'));
 assert(page.includes("Notification list is incomplete or unavailable. No partial results are displayed."));
 assert(page.includes("!loadFailed && !items.length"));
 assert(page.includes("verifyOwnedNotificationRows(data, userId)"));
});
test("Build135 owner-filtered realtime still aborts stale requests and disposes subscription",()=>{
 for(const x of ['supabase.channel(`notif-rt-${userId}`)','filter: `user_id=eq.${userId}`',
 'requestController?.abort()','ticket !== newestRequest',
 'supabase.removeChannel(channel)','active = false'])
  assert(page.includes(x),x);
});
test("Build135 update is both owner-filtered and exactly owner-acknowledged",()=>{
 assert(page.includes('if (loading || loadFailed ||'));
 assert(page.includes('items.some(n => n.id === id && n.user_id === userId && !n.is_read)'));
 assert(page.includes('.update({ is_read: true }).eq("id", id).eq("user_id", userId).select("id,user_id")'));
 assert(page.includes('data[0]?.user_id !== userId'));
 assert(page.includes("Notification update was not confirmed."));
});
test("Build135 notifications do not expose any global recipient feed or test seed insert",()=>{
 assert(!page.includes('supabase.from("notifications").insert('));
 assert(!page.includes('supabase.channel("notif-rt")'));
 assert(!page.includes('select("*")'));
 assert(!page.includes("service_role"));
});
test("Build135 pure validation helper has no DB calls or browser persistence",()=>{
 const src=readFileSync(new URL("../../src/lib/notifications-read-integrity.ts",import.meta.url),"utf8");
 for(const x of ["supabase.from","service_role","localStorage","sessionStorage",
 "process.env",".update(",".insert(",".delete("])
  assert(!src.includes(x),x);
});
