import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../../src/routes/_app.tsx",import.meta.url),"utf8");

test("Build130 header fetches exact owner-specific unread count, not arbitrary global count",()=>{
 assert(app.includes('.select("id", { count: "exact", head: true })'));
 assert(app.includes('.eq("user_id", userId).eq("is_read", false)'));
});

test("Build130 unknown server count never renders a claimed zero unread state",()=>{
 assert(app.includes("const [unreadVerified, setUnreadVerified] = useState(false)"));
 assert(app.includes("error || !Number.isSafeInteger(count) || count! < 0"));
 assert(app.includes("setUnreadVerified(false)"));
 assert(app.includes("setUnreadVerified(true)"));
 assert(app.includes("unreadVerified && unread > 0"));
 assert(app.includes('Unread notification count not verified'));
});

test("Build130 account switch resets owner-specific badge certainty",()=>{
 const block=app.slice(app.indexOf("useEffect(() => {",app.indexOf("function ApprovedAppShell(")));
 assert(block.includes("setUnread(0);"));
 assert(block.includes("setUnreadVerified(false);"));
 assert(app.includes("return <ApprovedAppShell key={session.user.id}"));
});

test("Build130 header preserves owner-filtered realtime and disposes it",()=>{
 assert(app.includes('supabase.channel(`hdr-notif-${userId}`)'));
 assert(app.includes('filter: `user_id=eq.${userId}`'));
 assert(app.includes("active = false;"));
 assert(app.includes("supabase.removeChannel(channel)"));
});

test("Build130 stale header requests cannot repaint another account",()=>{
 assert(app.includes("const request = ++latest"));
 assert(app.includes("active && request === latest"));
});

test("Build130 badge never activates notification or financial writes",()=>{
 assert(!app.includes("service_role"));
 assert(!app.includes('supabase.from("billing")'));
 assert(!app.includes('supabase.from("notifications").insert('));
});
