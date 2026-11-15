import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const dir=dirname(fileURLToPath(import.meta.url));
const read=x=>JSON.parse(readFileSync(join(dir,x),"utf8"));
const report=(rubric,snapshot,pkg)=>{
 const ld=rubric.milestones.filter(x=>x.group==="LD");
 if(ld.length!==5 || new Set(ld.map(x=>x.id)).size!==5 || ld.reduce((n,x)=>n+x.weight,0)!==10)throw Error("Fixed Category C scoring drift");
 const states=new Map(snapshot.statuses.map(x=>[x.id,x]));
 const points=ld.filter(x=>states.get(x.id)?.complete).reduce((n,x)=>n+x.weight,0);
 const accepted=ld.filter(x=>states.get(x.id)?.complete).map(x=>x.id);
 if(points!==pkg.formal_earned_points||points!==6 ||JSON.stringify(accepted)!==JSON.stringify(pkg.formally_evidenced_milestones))throw Error("False category acceptance");
 if(pkg.review_package.LD02.accepted||pkg.review_package.LD05.accepted||!pkg.no_additional_acceptance_claimed)throw Error("Independent acceptance not supplied");
 if(pkg.latest_build!==167||
    !Array.isArray(pkg.technical_integrity_controls)||
    pkg.technical_integrity_controls.length!==6||
    new Set(pkg.technical_integrity_controls.map(x=>x.id)).size!==6||
    pkg.technical_integrity_controls.some(x=>x.status!=="verified_offline"||
     !x.evidence?.startsWith("https://github.com/")))
   throw Error("Build167 verified engineering evidence ledger invalid");
 const prepared=[],blocked=[];
 for(const id of ["LD02","LD05"]){
  const x=pkg.review_package[id];
  if(x.source_preparation.length!==4)throw Error("Category exit step schema drift");
  x.source_preparation.forEach(y=>{if(y.state==="source_evidenced")prepared.push(y);else if(y.state==="pending")blocked.push(y);else throw Error("Unrecognized status")});
 }
 if(prepared.length!==4||blocked.length!==4)throw Error("Category work evidence count drift");
 const milestoneRows=ld.map(x=>`| ${x.id} | ${x.title} | ${states.get(x.id).complete?"Accepted":"Open"} | ${states.get(x.id).complete?x.weight:0}/${x.weight} |`).join("\n");
 const taskRows=["LD02","LD05"].flatMap(id=>pkg.review_package[id].source_preparation.map(x=>`| ${x.id} | ${x.note} | ${x.state==="source_evidenced"?"Source prepared":"Independent acceptance needed"} |`)).join("\n");
 return `# Category C — AI Lead Discovery (current focused workstream)

**Build ${pkg.latest_build} | 15 November 2026 | Official acceptance: ${points}/10 (${points*10}%) | Release HOLD.**

This is the **only active development category** for Build ${pkg.latest_build}; critical production audit security remains an independently owned release blocker, not a parallel development sprint.

## Category completion
**${accepted.length}/5 official milestones accepted.** The remaining gates are **LD02** and **LD05**, 2 weighted points each. Passing tests and draft policies do not close them.

| Formal milestone | Exit criterion | Acceptance status | Points |
|---|---|---|---:|
${milestoneRows}

## Remaining two milestones — tracked substeps

**${prepared.length}/8 source/preparation tasks evidenced, ${blocked.length}/8 still pending.** This engineering count is not the official 60% acceptance score and is not proof of a live lead pipeline.

| Substep | Requirement | Evidence stage |
|---|---|---|
${taskRows}

### LD02 outstanding decisions
Growth and Privacy/Compliance owners must individually approve specific industry/persona/geo ICP, public-business-only source domains, exclusions, permitted use and retention. The [guardrails document](https://docs.google.com/document/d/1i5SVldFxYaSi2Ew1i4YJ0pUAxtGTXJ2AyKRGck8w6Gk/edit) is labelled REVIEW DRAFT. Unspecified selections cannot be inferred from blanket authorizations.

### LD05 outstanding acceptance
Growth and BI owners must agree source quality, freshness, yield and conversion formulas, thresholds, human sample validation and real authorized business-only data evidence. The [CEO KPI design](https://docs.google.com/document/d/1FWA-0AtMrE4C6DAMQISnj6_1DBfICG7TIQkKUs6AO_o/edit) is also a REVIEW DRAFT. [Synthetic KPI program](./metrics.mjs) is executable with local fictional snapshots; no real revenue, contacts, replies, meetings, CRM writes or outreach are represented.

## Build167 completed offline technical controls — separate from required owner approvals

**6/6 synthetic engineering integrity controls verified offline.** This includes source provenance, two-stage review, KPI calculation, audit-to-handoff integrity, owner decision-gap checks and a separately curated fictional source/KPI reference rehearsal. It does not verify live business observations. These checks do **not** close either of the two remaining official milestones, permit sourcing real businesses, or replace independently verifiable Growth/Privacy/BI acceptance.

| Technical control | Evidence | Status |
|---|---|---|
| C-ENG01: Synthetic source discovery with provenance and duplicate control | [Focused CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43702502782) | Verified offline |
| C-ENG02: Separate synthetic Growth/CRM review and no-send handoff | [Focused CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43702502782) | Verified offline |
| C-ENG03: Synthetic KPI numerator, denominator and freshness computation | [Focused CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43702502782) | Verified offline |
| C-ENG04: Source-derived audit/lead/handoff tamper reconciliation | [Focused CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43703552075) | Verified offline |
| C-ENG05: LD02/LD05 draft approval completeness and safety gate preflight | [Focused CI](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43703552075) | Verified offline |
| C-ENG06: Separately hand-curated synthetic source/KPI and review-outcome reconciliation | [Focused PR](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/20) | Verified offline |

### Build 165 verified engineering
- LD02: specific approval and source-whitelist review packet prepared, still unsigned
- LD05: aggregate-only synthetic metrics implementation and adversarial tests added
- Existing LD01, LD03, LD04 remain accepted; official category score **6/10 (+0)**
- No production lead discovery, contact outreach, CRM write, or modification of audit-security release holds

### Build estimate and completion condition
**One review/acceptance cycle per remaining milestone (roughly 1–2 owner-gated delivery batches after scope choices and authorized observation evidence)** is a planning scenario, not a calendar countdown. If real approvals/data remain unavailable, the category cannot be truthfully declared 10/10 regardless of additional engineering builds.

**Overall programme:** 26/100 accepted, 12/43 fixed milestones evidenced, 31 open; main remains unprotected, the critical audit-security issue still holds production release. Category C completion does **not** imply production deployment eligibility.

Future build reports will keep Category C active until LD02 and LD05 receive their required independent acceptance, or will explicitly record the external blocker rather than silently switching categories.
`;
}
export {report};
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const rubric=read("../release-progress/v1-rubric.json");
 const snapshot=read("../release-progress/current.json");
 const pkg=read("category-c-v1.json");
 const rendered=report(rubric,snapshot,pkg);
 if(process.argv.includes("--check")){
  if(readFileSync(join(dir,"CATEGORY-C-STATUS.md"),"utf8")!==rendered)
   throw Error("Category C status is stale or disagrees with official evidence");
  process.stdout.write("CATEGORY C SCORE VERIFIED: LD 6/10, 3/5 milestones; 4/8 approval steps; 6/6 offline engineering checks; zero new signoffs\n");
 }else process.stdout.write(rendered);
}
