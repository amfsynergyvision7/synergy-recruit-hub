import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {evaluate,compareSnapshots} from "./score.mjs";
function render(rubric,snapshot,work){
 const states=new Map(snapshot.statuses.map(s=>[s.id,s]));
 const categories=rubric.groups.map((g,i)=>{
  const ms=rubric.milestones.filter(m=>m.group===g.id);
  const points=ms.filter(m=>states.get(m.id).complete).reduce((n,m)=>n+m.weight,0);
  return {label:String.fromCharCode(66+i),name:g.label,points,weight:g.weight,passed:ms.filter(m=>states.get(m.id).complete).length,total:ms.length};
 });
 const points=categories.reduce((n,g)=>n+g.points,0),done=snapshot.statuses.filter(x=>x.complete).length;
 if(points!==snapshot.expected_earned_points||rubric.milestones.length!==43||snapshot.statuses.length!==43)throw Error("Official status drift");
 if(work.snapshot_build!==snapshot.snapshot_build||work.official_gate!=="CRM09"||states.get("CRM09").complete)throw Error("Active audit lane misattributed");
 if(work.steps.length!==9||new Set(work.steps.map(s=>s.id)).size!==9)throw Error("Audit package version drift");
 for(const s of work.steps)if(s.status==="source_evidenced" && (!s.proof?.length||!s.proof.every(p=>p.startsWith("https://"))))throw Error("Source claim without evidence");
 const prepared=work.steps.filter(s=>s.status==="source_evidenced").length;
 const cRows=categories.map(g=>`| ${g.label} | ${g.name} | ${g.points}/${g.weight} (${Math.round(100*g.points/g.weight)}%) | ${g.passed}/${g.total} | ${g.points===g.weight?"Accepted":"Open"} |`).join("\n");
 const crmRows=rubric.milestones.filter(m=>m.group==="CRM").map(m=>`| ${m.id} | ${m.name} | ${states.get(m.id).complete?"Accepted":"Open"} | ${states.get(m.id).complete?m.weight:0}/${m.weight} |`).join("\n");
 const stageRows=work.steps.map(s=>`| ${s.id} | ${s.title} | ${s.status==="source_evidenced"?"Source evidenced":"Blocked / independent"} | ${s.proof.length?`[Evidence](${s.proof[0]})`:"Owner evidence pending"} |`).join("\n");
 return `# AMF Synergy Vision — Project status

**Build ${snapshot.snapshot_build} | 15 November 2026 | RELEASE HOLD**

## A — Official programme completion: ${points}/100 (${points}%)
**${done}/43 evidenced milestones; ${43-done} open; 0/6 workstreams fully accepted; +0 accepted points in Build 164.**

The 100-point v1 rubric is frozen. Draft code, test counts and source review never independently increase formal completion.

## B–H — Official category progress

| Area | Existing workstream | Accepted points | Milestones evidenced | Status |
|---|---|---:|---:|---|
${cRows}

The points in these seven categories sum to ${points}/100; category percentages are within-category values, **not extra programme points**.

## F / CRM — Ten official subcategories

| Gate | Exit criterion | State | Earned |
|---|---|---|---:|
${crmRows}

## Current engineering focus: AUD under CRM09 (audit history)

**${prepared}/9 source-preparation steps evidenced; ${9-prepared}/9 independent/hosted/live steps still open.** This is an engineering checklist, **not an accepted security or release percentage**. CRM09 remains unaccepted at **0/48 production security remediations**.

| Step | Subcategory / acceptance work | Status | Proof or owner dependency |
|---|---|---|---|
${stageRows}

**Immediate next blocker:** independent database/security owner review of live exposure and other audit producers, then controlled rollback/hosted UAT. Parallel GitHub dependencies: protect main, independently approve PR #15 and configure protected lab-only secrets. Never apply the review SQL on its own.

**Audit packet conditional remaining batches:** 2–5 milestone-closing batches **after** independent owner and hosted access prerequisites. With those absent, no finite build countdown can be defended.

## Cross-program release blockers

- GitHub main protection: missing; independent PR #15 reviews: 0
- Isolated hosted Auth: 0/9; fictional fixtures: 0/38; accepted hosted UAT: 0/140
- Production security remediations accepted: 0/48; release signoffs: 0/9
- Production audit rights unsafe; source-only PRs #16, #18 and full CRM #12 are unmerged
- No production/staging permission writes, live email, finance activation, or main merge authorized by passing draft CI

**Whole-project illustrative build arithmetic:** 31 open milestones / 3, 2, or 1 independently accepted milestones per batch gives approximately **11 / 16 / 31 milestone-closing batches**. This is not a promise or a delivery date; if no acceptance gates close, more builds do not make official progress.

## Build reporting rule

Every future build report must show: A accepted score and change; B–H category split; active workstream/milestone and substeps; specific new engineering evidence; owner blockers; conditional estimates. Validate via \`node security/release-progress/workstream-report.mjs --check\`.
`;
}
export {render};
const dir=dirname(fileURLToPath(import.meta.url));
const read=x=>JSON.parse(readFileSync(join(dir,x),"utf8"));
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const rubric=read("v1-rubric.json"),snapshot=read("current.json"),work=read("active-work-v1.json");
 const previous=read(snapshot.previous_file);
 const verified=evaluate(rubric,snapshot),delta=compareSnapshots(rubric,previous,snapshot);
 if(verified.earned!==26||delta.delta!==0||delta.newGates.length||delta.regressed.length)throw Error("Unverified acceptance change");
 const md=render(rubric,snapshot,work);
 if(process.argv.includes("--check")){
  if(md!==readFileSync(join(dir,"CURRENT-STATUS.md"),"utf8"))throw Error("Progress report out of sync with evidence sources");
  process.stdout.write("AMF STATUS CHECK PASS — 26/100 official; 4/9 audit source steps; release HOLD\n");
 }else process.stdout.write(md);
}
