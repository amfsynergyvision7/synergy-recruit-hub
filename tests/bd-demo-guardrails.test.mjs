import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const route = read("src/routes/_app.bd.tsx");
const sidebar = read("src/components/AppSidebar.tsx");
const model = read("src/lib/bd-demo-model.ts");

test("BD demo route is disabled unless explicitly enabled", () => {
  assert.match(route, /import\.meta\.env\.VITE_ENABLE_BD_DEMO\s*!==\s*"true"/);
  assert.match(route, /Business Development prototype disabled/);
});
test("BD demo requires admin role and does not grant production permissions", () => {
  assert.match(route, /role\s*!==\s*"admin"/);
  assert.match(route, /Production BD permissions have not been implemented/);
});
test("BD demo sidebar is feature-flagged", () => {
  assert.match(sidebar, /import\.meta\.env\.VITE_ENABLE_BD_DEMO\s*===\s*"true"/);
});
test("BD model has no Supabase or external transport dependency", () => {
  assert.doesNotMatch(model, /from\s+["'](?:@supabase|.*supabase)|fetch\s*\(|sendMail\s*\(/);
  assert.match(route, /structuredClone\(seed\)/);
  assert.match(route, /SYNTHETIC DEMO/);
});
