import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasCompleteIdList } from "../../src/lib/crm-list-integrity.ts";
import { filterOwnedNotificationRows } from "../../src/lib/notification-owner.ts";

const src=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const page=src("src/routes/_app.notifications.tsx");

const owned=n=>Array.from({length:n},(_,i)=>({
 id:"notif_"+(i+1),user_id:"u-1",title:"Synthetic notification",type:"generic",is_read:false
}));

test("Build129 owner-bound complete notification page permits empty and exact 100",()=>{
 assert.equal(hasCompleteIdList([],0,100),true);
 assert.equal(hasCompleteIdList(owned(100),100,100),true);
 assert.equal(filterOwnedNotificationRows(owned(2),"u-1").length,2);
});

test("Build129 notification list refuses a real count over 100 rather than hiding overflow",()=>{
 assert.equal(hasCompleteIdList(owned(100),101,100),false);
 assert.equal(hasCompleteIdList(owned(100),1001,100),false);
});

test("Build129 notification list refuses missing, duplicate or mismatched count",()=>{
 for(const value of [null,undefined,NaN,-1,1.5])assert.equal(hasCompleteIdList(owned(2),value,100),false);
 assert.equal(hasCompleteIdList(owned(2),1,100),false);
 assert.equal(hasCompleteIdList([{id:"dup"},{id:"dup"}],2,100),false);
});

test("Build129 owner predicate cannot accept a cross-account notification",()=>{
 const rows=[...owned(2),{id:"other",user_id:"u-2"}];
 assert.equal(rows.every(row=>row.user_id==="u-1"),false);
 assert.equal(filterOwnedNotificationRows(rows,"u-1").length,2);
});

test("Build129 live feed query checks exact total, ordered and bounded by owner",()=>{
 assert(page.includes('.select("id,user_id,title,message,type,is_read,created_at", { count: "exact" })'));
 assert(page.includes('.eq("user_id", userId)'));
 assert(page.includes('.order("id", { ascending: true }).range(from, to).abortSignal(signal)'));
 assert(page.includes('readCompleteCrmRows<NotificationItem>('));
 assert(page.includes('verifyOwnedNotificationRows(data, userId)'));
});

test("Build129 notifications never show apparently complete number when read is unverified",()=>{
 assert(page.includes('setLoadFailed(true)'));
 assert(page.includes('Notification list unavailable'));
 assert(page.includes("Notification list is incomplete or unavailable. No partial results are displayed."));
 assert(page.includes("!loadFailed && !items.length"));
});

test("Build129 notifications abort stale reads on overlap and unmount",()=>{
 assert(page.includes("requestController?.abort()"));
 assert(page.includes("new AbortController()"));
 assert(page.includes(".abortSignal(signal)"));
 assert(page.includes("ticket !== newestRequest"));
 assert(page.includes("controller.signal.aborted"));
 assert(page.includes("active = false"));
});

test("Build129 notifications retain account-keyed mount and server owner check",()=>{
 assert(page.includes('canMountApprovedCrm(user.id, profile, role)'));
 assert(page.includes('return <OwnedNotifications key={user.id} userId={user.id} />'));
 assert(page.includes('filterOwnedNotificationRows(verified, userId)'));
});

test("Build129 realtime channel stays owner-scoped and is disposed on unmount",()=>{
 assert(page.includes('supabase.channel(`notif-rt-${userId}`)'));
 assert(page.includes('filter: `user_id=eq.${userId}`'));
 assert(page.includes("supabase.removeChannel(channel)"));
 assert(!page.includes('supabase.channel("notif-rt")'));
});

test("Build129 owner and ID are both checked before mark-read mutation",()=>{
 assert(page.includes("items.some(n => n.id === id && n.user_id === userId && !n.is_read)"));
 assert(page.includes('.update({ is_read: true }).eq("id", id).eq("user_id", userId).select("id,user_id")'));
 assert(page.includes("data?.length !== 1 || data[0]?.id !== id"));
 assert(page.includes("data[0]?.user_id !== userId"));
 assert(page.includes("Notification update was not confirmed."));
});
