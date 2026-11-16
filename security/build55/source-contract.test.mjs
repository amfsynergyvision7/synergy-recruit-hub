import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("security/build55/candidate-delete-impact-review-only.sql","utf8");
const cases=readFileSync("security/build55/candidate-delete-impact-cases.sql","utf8");
const fk=readFileSync("security/build55/candidate-fk-fixture.sql","utf8");
test("deletion impact is admin-only and contains no SQL mutation",()=>{
 assert.match(source,/v_actor uuid:=auth\.uid\(\)/);
 assert.match(source,/p\.status='approved' AND p\.is_active IS TRUE/);
 assert.match(source,/r\.role='admin'/);
 assert.match(source,/CREATE OR REPLACE FUNCTION public\.crm_candidate_delete_impact/);
 assert.match(source,/GRANT EXECUTE ON FUNCTION public\.crm_candidate_delete_impact\(uuid\)\s+TO authenticated/);
 assert.match(source,/REVOKE ALL ON FUNCTION public\.crm_candidate_delete_impact\(uuid\)/);
 const body=source.split("AS $impact55$")[1]?.split("END $impact55$;")[0];
 assert.ok(body);
 assert.doesNotMatch(body,/\b(?:INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE|EXECUTE)\b/i);
 assert.match(body,/FOR SHARE/);
 assert.match(body,/'allowed_to_delete',false/);
});
test("live source derived impacts have exact cascade and detach shape",()=>{
 for(const tab of ["submissions","interviews","offers","candidate_stage_history"])
  assert.match(fk,new RegExp(tab+"[\\s\\S]*ON DELETE CASCADE"));
 assert.match(fk,/ALTER TABLE public\.billing ADD CONSTRAINT/);
 assert.match(fk,/ON DELETE SET NULL/);
 assert.match(cases,/Never persist legacy deletion/);
 assert.match(cases,/Caught subtransaction failed to restore related rows/);
});
