import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterOwnedNotificationRows } from "../../src/lib/notification-owner.ts";

const page = readFileSync(new URL("../../src/routes/_app.notifications.tsx", import.meta.url), "utf8");

test("Build117 only the signed-in recipient's notification records survive", () => {
  const rows = [{id:"a",user_id:"user-a"}, {id:"b",user_id:"user-b"},
    {id:"c",user_id:"user-a"}, {id:"none",user_id:null}, null];
  assert.deepEqual(filterOwnedNotificationRows(rows,"user-a").map(r=>r.id),["a","c"]);
  assert.deepEqual(filterOwnedNotificationRows(rows,"user-b").map(r=>r.id),["b"]);
  assert.deepEqual(filterOwnedNotificationRows(rows,null),[]);
  assert.deepEqual(filterOwnedNotificationRows(null,"user-a"),[]);
});

test("Build117 notifications page rejects an absent, inactive or mismatched account before query", () => {
  assert(page.includes('canMountApprovedCrm(user.id, profile, role)'));
  assert(page.includes("return <OwnedNotifications key={user.id} userId={user.id} />"));
  assert(page.indexOf("function OwnedNotifications(")>page.indexOf("function Page()"));
});

test("Build117 notification feed scopes both SQL query and realtime subscription", () => {
  assert(page.includes('.eq("user_id", userId)'));
  assert(page.includes('filter: `user_id=eq.${userId}`'));
  assert(page.includes('supabase.channel(`notif-rt-${userId}`)'));
  assert(page.includes("filterOwnedNotificationRows(data, userId)"));
  assert(page.includes("if (!active || ticket !== newestRequest) return"));
  assert(page.includes("active = false;"));
  assert(page.includes("supabase.removeChannel(channel)"));
  assert(!page.includes('supabase.channel("notif-rt")'));
});

test("Build117 mark-read is owner-bound and exactly acknowledged; test-seed insert removed", () => {
  assert(page.includes("items.some(n => n.id === id && n.user_id === userId && !n.is_read)"));
  assert(page.includes('.update({ is_read: true }).eq("id", id).eq("user_id", userId).select("id")'));
  assert(page.includes("data?.length !== 1 || data[0]?.id !== id"));
  assert(page.includes("Notification update was not confirmed."));
  assert(!page.includes("Create test reminder"));
  assert(!page.includes('supabase.from("notifications").insert('));
});
