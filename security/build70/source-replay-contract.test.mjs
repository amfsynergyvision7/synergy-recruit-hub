import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("security/build70/five-recruiter-view-semantics.rollback.sql","utf8");
const prior=JSON.parse(readFileSync("security/build69/recruiter-view-scope-audit.json","utf8"));
test("five live view definitions retain their independent source MD5s before proposed patch",()=>{
 for(const v of prior.views){
  assert.ok(sql.includes("actual live source MD5 "+v.definition_md5));
  assert.ok(sql.includes("CREATE VIEW public."+v.view_name+" AS"));
  assert.ok(sql.includes("CREATE OR REPLACE VIEW public."+v.view_name+" WITH (security_invoker=true) AS"));
 }
 assert.equal((sql.match(/CREATE VIEW public\./g)||[]).length,5);
 assert.equal((sql.match(/CREATE OR REPLACE VIEW public\./g)||[]).length,5);
 assert.match(sql,/sum\(total_candidates\)/);
 assert.match(sql,/Original production view/);
 assert.match(sql,/Hardened view/);
});
test("rollback-only test has no production hostname, external data or COMMIT",()=>{
 assert.match(sql,/^-- BUILD70: DISPOSABLE POSTGRES ONLY/);
 assert.match(sql,/\bBEGIN;\nSET LOCAL statement_timeout/);
 assert.match(sql,/\nROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/(?:^|\n)\s*COMMIT\s*;/i);
 assert.doesNotMatch(sql,/wusntntcqgtpgokggdzv|dhlhlasnaapzckjyvffn/);
 assert.match(sql,/example\.invalid/);
 assert.doesNotMatch(sql,/\bCOPY\s+public\./i);
 assert.match(sql,/EXCEPT SELECT/);
});
test("role and active predicates narrow all five and retain projection structure",()=>{
 assert.equal((sql.match(/AND EXISTS \(SELECT 1 FROM public\.user_roles ur/g)||[]).length,5);
 assert.equal((sql.match(/is_active = true/g)||[]).length,5);
 assert.equal((sql.match(/ur\.role = 'recruiter'::public\.app_role/g)||[]).length,5);
 assert.match(sql,/IF EXISTS \(/);
 assert.match(sql,/Changed public view output schema/);
});

test("actual synthetic RLS uses nine distinct actor contexts and invoker view grants",()=>{
 assert.equal((sql.match(/SET LOCAL app\.synthetic_actor =/g)||[]).length,9);
 assert.equal((sql.match(/CREATE POLICY (profiles_actor_read|roles_actor_read|candidates_actor_read)/g)||[]).length,3);
 assert.match(sql,/SET LOCAL ROLE authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.profiles,public\.user_roles,public\.candidates TO authenticated/);
 assert.match(sql,/ALTER TABLE public\.profiles ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE public\.user_roles ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE public\.candidates ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/synthetic pending recruiter: view % expected 0/);
 assert.match(sql,/synthetic inactive recruiter: view % expected 0/);
 assert.match(sql,/synthetic missing profile: view % expected 0/);
 assert.match(sql,/synthetic admin: view % expected 2/);
 assert.match(sql,/synthetic recruiter A: view % expected 1/);
 assert.match(sql,/synthetic recruiter B: view % expected 1/);
 assert.match(sql,/RESET ROLE/);
});
