import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("security/build57/billing-write-lockdown-review-only.sql","utf8");
const cases=readFileSync("security/build57/billing-lockdown-cases.sql","utf8");
const wf=readFileSync(".github/workflows/security-build34-review.yml","utf8");
test("financial privilege lockdown is always-on and restricts all 3 API roles",()=>{
 assert.match(sql,/REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/REVOKE INSERT\(%s\),UPDATE\(%s\),REFERENCES\(%s\)/);
 assert.match(sql,/pg_attribute/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON public\.billing/);
 assert.match(sql,/BEFORE TRUNCATE ON public\.billing/);
 assert.doesNotMatch(sql,/set_config\(|current_setting\(|app\.billing_override|COMMIT;/);
});
test("fixture verifies billing data survives rejected owner and API writes",()=>{
 for(const op of ["INSERT","UPDATE","DELETE","TRUNCATE"])
   assert.match(cases,new RegExp("Invoice "+op+" unexpectedly succeeded"));
 for(const role of ["authenticated","service_role","anon"])
   assert.match(cases,new RegExp("SET ROLE "+role));
 assert.match(cases,/has_any_column_privilege/);
 assert.match(cases,/v_final<>v_initial/);
 assert.match(wf,/build57-billing-lockdown-review/);
});
