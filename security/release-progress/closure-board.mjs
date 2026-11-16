/**
 * Read-only release-closure register from frozen rubric and signed snapshot.
 * Not a live acceptance source. No hosted writes, new workstream approvals,
 * external communications or automatic milestone closure.
 */
import {readFileSync,appendFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {evaluate} from "./score.mjs";
const here=dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(readFileSync(join(here,name),"utf8"));
const rubric=read("v1-rubric.json"), recorded=read("current.json");
const status=new Map(recorded.statuses.map(x=>[x.id,x]));
const result=evaluate(rubric,recorded);
const lines=[
 "# AMF release closure — recorded acceptance (NOT live release approval)",
 "",
 "**Last milestone snapshot:** "+recorded.as_of+" (build "+recorded.snapshot_build+"). Historical evidence-backed status; not fresh independent approval.",
 "**Accepted:** "+result.earned+"/100 points, "+result.completed_milestones+"/"+result.milestones_total+" milestones. **Outstanding:** "+result.remaining+"/100 points, "+(result.milestones_total-result.completed_milestones)+" milestones.",
 "",
 "| Workstream | Accepted / total | Open gates |",
 "| --- | ---: | --- |"
];
for(const g of result.groups){
 const open=rubric.milestones.filter(m=>m.group===g.id&&!status.get(m.id).complete);
 lines.push("| "+g.id+" — "+g.label.replace(/\|/g,"/")+" | "+g.earned+"/"+g.weight+" | "+open.map(x=>x.id).join(", ")+" |");
}
lines.push("",
 "## Parallel milestone-closure lanes (each needs actual owner acceptance)",
 "",
 "| Lane | First unblocker | Exact evidence needed | Owner role |",
 "| --- | --- | --- | --- |",
 "| Repository governance | REL01 | Protect main; required checks, independent review, no bypass/force-push; readback | GitHub admin |",
 "| Nonproduction identities | REL03 → CRM06 → CRM07 → CRM08 | Protected lab & secrets; 9 fictional Auth identities; 38 inert rows; 140 independently signed UAT cases | Security / UAT / DBA |",
 "| Coordinated production security | CRM09 + issues #19, #26–29 | Reviewed notification, helper and audit controls; service callers, backup/PITR and 48-object after-state | Security / DBA / Privacy |",
 "| CRM workflow release | CRM05 → CRM10 | Independent PR12 review and signed workflow ownership, audit and finance holds | CRM reviewer / Operations |",
 "| Lead Discovery Category C | LD02 → LD05 | Approved ICP and public sources; observed traceable KPI sample and Growth/BI signoff | Growth / Privacy / BI |",
 "| Marketing, Sales, BI, Knowledge | KB04–06, MK02–05, SO02–05, BI01–05 | Approved policies, pilots, metric definitions and independently accepted observations | Workstream owners |",
 "| Controlled release | REL04–07 | Backup/restore, legal/privacy clearance, 9 owner signatures, monitored rollback-ready deployment | Release board / Operations |",
 "",
 "## Rules",
 "",
 "- A green CI run, copied SQL draft, preview deployment or extra numbered build cannot close a milestone.",
 "- Do not change v1 scoring weights or self-approve owners. Update current.json only after exact evidence and an authorized independent acceptance event.",
 "- A narrower internal demo is allowed only as a separately labelled scope; it cannot mean the six-workstream programme is complete.",
 "- Stop serial test accumulation: prioritize signed decision gates, run workstreams concurrently and test only specific remaining acceptance criteria.",
 "",
 "Release blocker: https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14",
 "Hosted lab: https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13",
 "Category C: https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/21",
 ""
);
const out=lines.join("\n");
console.log(out);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,out+"\n");
