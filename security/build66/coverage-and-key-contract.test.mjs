import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PRIVATE_EXTRA_TABLES,PUBLIC_VIEWS,PRIVATE_BRANDING_COLUMNS,PUBLIC_BRANDING_COLUMNS}
 from "./hosted-anon-extra-scope.mjs";
import {assertUnprivilegedUatKey} from "./uat-key-gate.mjs";

const coverage=JSON.parse(readFileSync("security/build65/production-hosted-coverage.json","utf8"));
test("anonymous-surface lab covers all four omitted tables and thirteen omitted views",()=>{
 assert.equal(coverage.production_public_table_count,19);
 assert.equal(coverage.uncovered_production_tables.length,4);
 assert.deepEqual(coverage.uncovered_production_tables,
  ["app_settings",...PRIVATE_EXTRA_TABLES].sort());
 assert.deepEqual(PUBLIC_VIEWS,[...coverage.uncovered_production_views]);
 assert.equal(PUBLIC_VIEWS.length,13);
 assert.equal(new Set(PUBLIC_VIEWS).size,13);
 assert.deepEqual(PUBLIC_BRANDING_COLUMNS,["logo_url","default_color_theme"]);
 assert.deepEqual(PRIVATE_BRANDING_COLUMNS,
  ["resume_import_folder_url","updated_by","updated_at"]);
 assert.equal(coverage.current_release_all_scope_acceptance,false);
});
test("dedicated hosted UAT API-key classifier fails closed to privileged JWT",()=>{
 const makeRole=(role)=>["hdr",
  Buffer.from(JSON.stringify({role})).toString("base64url"),"sig"].join(".");
 assert.doesNotThrow(()=>assertUnprivilegedUatKey("sb_publishable_offline"));
 assert.doesNotThrow(()=>assertUnprivilegedUatKey(makeRole("anon")));
 for(const key of ["sb_secret_offline","sb_service_role_offline",makeRole("service_role"),
  makeRole("authenticated"),"unknown-key","",null]){
  assert.throws(()=>assertUnprivilegedUatKey(key));
 }
});
