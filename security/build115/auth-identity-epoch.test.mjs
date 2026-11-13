import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAuthIdentityEpoch, authorizedRoleForProfile } from "../../src/lib/auth-identity-epoch.ts";

const authSource = readFileSync(new URL("../../src/hooks/use-auth.tsx", import.meta.url), "utf8");
const p = (id, status = "approved", active = true) =>
  ({ id, status, is_active: active, full_name: "Synthetic Account" });

test("Build115 account switches immediately invalidate old account role/profile lookups", () => {
  const gate = createAuthIdentityEpoch();
  const a = gate.issue("user-A");
  assert.equal(gate.accepts(a), true);
  const b = gate.issue("user-B");
  assert.equal(gate.accepts(a), false);
  assert.equal(gate.accepts(b), true);
  assert.equal(gate.currentUser(), "user-B");
  const back = gate.issue("user-A");
  assert.equal(gate.accepts(a), false, "a late user-A result must remain stale after returning to A");
  assert.equal(gate.accepts(b), false);
  assert.equal(gate.accepts(back), true);
});

test("Build115 same-user refresh invalidates any earlier pending profile request", () => {
  const gate = createAuthIdentityEpoch();
  const pending = gate.issue("user-A");
  const refresh = gate.issue("user-A");
  assert.equal(gate.accepts(pending), false);
  assert.equal(gate.accepts(refresh), true);
  assert.throws(() => gate.issue(""), /nonempty user ID/);
});

test("Build115 sign-out and effect disposal both invalidate pending permissions", () => {
  const gate = createAuthIdentityEpoch();
  const pending = gate.issue("user-A");
  const initial = gate.revision();
  const signedOut = gate.issue(null);
  assert.equal(signedOut.userId, null);
  assert.equal(gate.currentUser(), null);
  assert.equal(gate.accepts(pending), false);
  assert.notEqual(gate.revision(), initial,
    "late getSession must not replace a sign-out");
  const newLogin = gate.issue("user-B");
  gate.dispose();
  assert.equal(gate.accepts(newLogin), false);
  assert.equal(gate.currentUser(), null);
  assert.equal(gate.issue("user-A"), null);
});

test("Build115 role lookup denies mismatched, pending, inactive and missing profiles", () => {
  const roles = [{ role: "admin" }];
  for (const bad of [p("user-B"), p("user-A", "pending"), p("user-A", "approved", false), null]) {
    assert.equal(authorizedRoleForProfile("user-A", bad, roles), null);
  }
  assert.equal(authorizedRoleForProfile("user-A", p("user-A"), null), null);
  assert.equal(authorizedRoleForProfile("user-A", p("user-A"), [{ role: "unknown" }]), null);
  assert.equal(authorizedRoleForProfile("user-A", p("user-A"), []), null);
  assert.equal(authorizedRoleForProfile("user-A", p("user-A"), [{ role: "viewer" }]), "viewer");
  assert.equal(authorizedRoleForProfile("user-A", p("user-A"),
    [{ role: "viewer" }, { role: "admin" }]), "admin");
});

test("Build115 auth context applies freshness gate on success, catch and finally", () => {
  assert.match(authSource, /if \(!gate\.accepts\(ticket\)\) return;/);
  assert.match(authSource, /if \(gate\.accepts\(ticket\)\) \{/);
  assert.match(authSource, /if \(gate\.accepts\(ticket\)\) setLoading\(false\);/);
  assert.match(authSource, /prof\?\.id === ticket\.userId/);
  assert.match(authSource, /authorizedRoleForProfile\(ticket\.userId, matchedProfile, roles\)/);
  assert.match(authSource, /setProfile\(null\);\s*setRole\(null\);\s*setLoading\(true\)/);
  assert.match(authSource, /if \(!receivedAuthEvent && gate\.revision\(\) === initialRevision\)/);
  assert.match(authSource, /gate\.dispose\(\)/);
  assert.match(authSource, /subscription\.unsubscribe\(\)/);
  assert.doesNotMatch(authSource, /setRole\(\(found \?\? "viewer"\)/);
  assert.doesNotMatch(authSource, /setTimeout\(\(\) => loadProfile\(s\.user\.id\)/);
});

test("Build115 auth callback defers DB reads and sign-out synchronously clears permissions", () => {
  const callback = authSource.slice(
    authSource.indexOf("supabase.auth.onAuthStateChange("),
    authSource.indexOf("const initialRevision", authSource.indexOf("supabase.auth.onAuthStateChange(")),
  );
  assert.match(callback, /receivedAuthEvent = true;/);
  assert.match(callback, /publish\(next\);/);
  assert.doesNotMatch(callback, /await supabase\.from/);
  const signOut = authSource.slice(
    authSource.indexOf("const signOut = async () => {"),
    authSource.indexOf("return (\n    <Ctx.Provider", authSource.indexOf("const signOut = async () => {")),
  );
  assert(signOut.indexOf("identity.current.issue(null)") < signOut.indexOf("await supabase.auth.signOut()"));
  assert(signOut.indexOf("setRole(null)") < signOut.indexOf("await supabase.auth.signOut()"));
});
