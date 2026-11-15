import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,statSync} from "node:fs";
import {join,dirname,resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const folder=join(root,"security/lead-discovery");
const read=x=>JSON.parse(readFileSync(join(root,x),"utf8"));
const jsFiles=()=>readdirSync(folder,{recursive:true,withFileTypes:true})
 .filter(x=>x.isFile()&&x.name.endsWith(".mjs"))
 .map(x=>join(x.parentPath||x.path,x.name));
test("Build170 self-contained lead source uses only local or node builtins",()=>{
 const candidates=jsFiles();
 assert(candidates.length>=7);
 for(const path of candidates){
  const source=readFileSync(path,"utf8");
  for(const m of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)){
   const dep=m[1];
   assert(dep.startsWith("node:")||dep.startsWith("./")||dep.startsWith("../"),
    path+" external runtime dependency "+dep);
   if(dep.startsWith(".")){
    const location=resolve(dirname(path),dep);
    assert(!relative(folder,location).startsWith(".."),
     path+" reads code outside isolated Category C");
   }
  }
 }
});
test("Build170 only fictional business domains in default source research",()=>{
 const manifest=read("security/lead-discovery/manifest.synthetic.json");
 const policy=read("security/lead-discovery/lead-policy.review.json");
 assert.equal(manifest.mode,"SYNTHETIC_OFFLINE_ONLY");
 assert(manifest.sources.every(x=>x.source_url.includes(".example.invalid")));
 assert.equal(policy.live_lead_discovery_enabled,false);
 assert.equal(policy.required_decisions.permitted_public_business_sources.length,0);
 assert.equal(policy.required_decisions.crm_writes_allowed,false);
});
test("Build170 historic scorecard unchanged, 6/10 category remains nonoperational",()=>{
 const baseline=read("security/release-progress/current.json"),
  rubric=read("security/release-progress/v1-rubric.json"),
  ledger=read("security/lead-discovery/category-c-v1.json");
 assert.equal(baseline.snapshot_build,138);
 assert.equal(baseline.expected_earned_points,26);
 assert.equal(baseline.observations.git.main_sha,"c735292fbace6605d691a68b602a02b2c6f9e137");
 assert.equal(ledger.formal_earned_points,6);
 assert.equal(ledger.review_package.LD02.accepted,false);
 assert.equal(ledger.review_package.LD05.accepted,false);
 assert.equal(rubric.milestones.filter(m=>m.group==="LD").reduce((n,x)=>n+x.weight,0),10);
});
test("Build170 isolated main PR maintains explicit intentional release hold",()=>{
 const w=readFileSync(join(root,".github/workflows/build165-category-c.yml"),"utf8");
 assert(w.includes("security/build170-lead-category/main-isolation.test.mjs"));
 assert(w.includes("main-release-hold:"));
 assert(w.includes("github.base_ref == 'main'"));
 assert(w.includes("exit 1"));
 assert(!w.includes("workflow_dispatch:"));
});
test("Build170 no financial, Auth or live network side effects in lead source",()=>{
 const js=jsFiles();
 for(const path of js){
  const contents=readFileSync(path,"utf8");
  for(const dangerous of ["createClient(","sendEmail(","https.request(","http.request(","fetch(",
    "writeFileSync(","writeFile(","appendFileSync(","process.env.SUPABASE_SERVICE_ROLE"])
   assert(!contents.includes(dangerous),path+" forbidden side-effect reference "+dangerous);
 }
});
