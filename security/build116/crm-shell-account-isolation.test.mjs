import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canMountApprovedCrm } from "../../src/lib/crm-shell-access.ts";

const layout = readFileSync(new URL("../../src/routes/_app.tsx", import.meta.url), "utf8");
const active = (id) => ({ id, status: "approved", is_active: true });

test("Build116 private CRM mounts only for same-subject approved active known-role account", () => {
  for (const role of ["admin", "recruiter", "operations", "finance", "viewer"])
    assert.equal(canMountApprovedCrm("account-A", active("account-A"), role), true);
  for (const [user, profile, role] of [
    ["account-A", active("account-B"), "admin"],
    ["account-A", active("account-A"), null],
    ["account-A", active("account-A"), "unknown"],
    ["account-A", { id: "account-A", status: "pending", is_active: true }, "admin"],
    ["account-A", { id: "account-A", status: "suspended", is_active: true }, "admin"],
    ["account-A", { id: "account-A", status: "approved", is_active: false }, "admin"],
    ["account-A", null, "admin"],
    [null, active("account-A"), "admin"],
  ]) assert.equal(canMountApprovedCrm(user, profile, role), false);
});

test("Build116 private search and Outlet render only inside identity-keyed shell", () => {
  const deny = layout.indexOf("if (!canMountApprovedCrm(session.user.id, profile, role)");
  const shell = layout.indexOf("return <ApprovedAppShell key={session.user.id}");
  const root = layout.indexOf("function ApprovedAppShell(");
  assert(deny > 0 && shell > deny && root > shell);
  assert(layout.indexOf("<GlobalSearch />") > root);
  assert(layout.indexOf("<Outlet />") > root);
  assert(layout.includes("fullName={profile!.full_name} role={role}"));
});

test("Build116 notification badge and subscription are owner-scoped with stale result protection", () => {
  assert(layout.includes("setUnread(0);"));
  assert(layout.includes('.eq("user_id", userId).eq("is_read", false)'));
  assert(layout.includes('filter: `user_id=eq.${userId}`'));
  assert(layout.includes('supabase.channel(`hdr-notif-${userId}`)'));
  assert(layout.includes("if (active && request === latest)"));
  assert(layout.includes("active = false;"));
  assert(layout.includes("supabase.removeChannel(channel)"));
  assert(!layout.includes('supabase.channel("hdr-notif")'));
});

test("Build116 missing role, profile and session remain outside private tree", () => {
  assert(layout.includes("if (loading || !session)"));
  assert(layout.includes("if (!canMountApprovedCrm(session.user.id, profile, role) || !role)"));
  assert(layout.indexOf("return <ApprovedAppShell key=")>layout.indexOf("CRM access not available"));
});
