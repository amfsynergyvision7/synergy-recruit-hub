import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir=dirname(fileURLToPath(import.meta.url));
export function readLocal(name) { return JSON.parse(readFileSync(join(dir,name),"utf8")); }
export function evaluate(rubric, snapshot) {
  if (rubric.schema_version!==snapshot.schema_version) throw new Error("Rubric and snapshot version mismatch");
  const ids=new Set(), states=new Map();
  for (const state of snapshot.statuses) {
    if (states.has(state.id)) throw new Error("Duplicate snapshot gate "+state.id);
    states.set(state.id,state);
  }
  const total=rubric.milestones.reduce((x,m)=>{
    if(ids.has(m.id))throw new Error("Duplicate rubric ID "+m.id);
    ids.add(m.id);if(!Number.isInteger(m.weight)||m.weight<=0)throw new Error("Invalid weight");
    const state=states.get(m.id);
    if(!state||typeof state.complete!=="boolean")throw new Error("Missing state "+m.id);
    if(state.complete&&(!Array.isArray(state.evidence)||state.evidence.length===0))
      throw new Error("Completed gate lacks evidence: "+m.id);
    if(state.complete&&!state.evidence.every(x=>typeof x==="string"&&/^https:\/\//.test(x)))
      throw new Error("Invalid evidence link: "+m.id);
    return x+m.weight;
  },0);
  if(states.size!==ids.size)throw new Error("Unexpected snapshot gate IDs");
  if(total!==100)throw new Error("Weights are not 100");
  const groups=rubric.groups.map(g=>{
    const rows=rubric.milestones.filter(m=>m.group===g.id);
    const points=rows.reduce((n,m)=>n+m.weight,0);
    if(points!==g.weight)throw new Error("Group weight drift "+g.id);
    const earned=rows.reduce((n,m)=>n+(states.get(m.id).complete?m.weight:0),0);
    return {id:g.id,label:g.label,earned,weight:points,completed:rows.filter(m=>states.get(m.id).complete).length,total:rows.length};
  });
  if(groups.reduce((s,g)=>s+g.weight,0)!==100)throw new Error("Group sum drift");
  const earned=groups.reduce((s,g)=>s+g.earned,0);
  if(earned!==snapshot.expected_earned_points)throw new Error("Score does not match evidence states");
  const closedWorkstreams=groups.filter(g=>g.id!=="REL"&&g.earned===g.weight).length;
  const gate=(id)=>states.get(id).complete;
  const o=snapshot.observations;
  if(gate("CRM06")&&o.lab.auth_users!==9)throw new Error("GoTrue Auth evidence does not match CRM06");
  if(gate("CRM07")&&o.lab.fixture_rows!==38)throw new Error("Hosted fixtures do not match CRM07");
  if(gate("CRM08")&&o.formal_acceptance.hosted_signed_uat.accepted!==140)
    throw new Error("Signed hosted UAT not accepted");
  if(gate("CRM09")&&o.formal_acceptance.production_security_remediations.accepted!==48)
    throw new Error("Production remediation not accepted");
  if(gate("REL01")&&(!o.git.main_protected||o.git.ruleset_count<1))
    throw new Error("Protected main not verified");
  if(gate("REL02")&&(!o.git.pr15_merged||o.git.pr15_independent_reviews<1||!gate("REL01")))
    throw new Error("Independent protected PR15 merge not verified");
  if(gate("REL06")&&o.formal_acceptance.release_signoffs.signed!==9)
    throw new Error("Nine signed release gates not accepted");
  if(gate("REL07")&&(!gate("REL06")||!gate("CRM08")||!gate("CRM09")||!gate("REL04")))
    throw new Error("Production deploy prerequisites missing");
  if(o.formal_acceptance.closed_workstreams.accepted<closedWorkstreams)
    throw new Error("Accepted workstream count trails completed groups");
  return {earned,remaining:100-earned,milestones_total:ids.size,
    completed_milestones:[...states.values()].filter(x=>x.complete).length,
    groups,closedWorkstreams};
}
export function compareSnapshots(rubric, previous, current){
  const old=evaluate(rubric,previous),now=evaluate(rubric,current);
  const oldStates=new Map(previous.statuses.map(s=>[s.id,s.complete]));
  const newGates=current.statuses.filter(s=>s.complete&&!oldStates.get(s.id)).map(s=>s.id).sort();
  const regressed=current.statuses.filter(s=>!s.complete&&oldStates.get(s.id)).map(s=>s.id).sort();
  if(current.previous_earned_points!==old.earned ||
     current.delta_points!==now.earned-old.earned)
    throw new Error("Unreconciled points delta");
  if(JSON.stringify(newGates)!==JSON.stringify([...current.newly_closed_ids].sort())||
     JSON.stringify(regressed)!==JSON.stringify([...current.regressed_ids].sort()))
    throw new Error("Unreconciled milestone change IDs");
  return {previous:old.earned,current:now.earned,delta:now.earned-old.earned,newGates,regressed};
}
export function progressBar(earned,width=30){
  const filled=Math.round(width*earned/100);
  return "█".repeat(filled)+"░".repeat(width-filled);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const rubric=readLocal("v1-rubric.json");
  const s=readLocal("current.json"),prior=readLocal(s.previous_file);
  const x=evaluate(rubric,s),changes=compareSnapshots(rubric,prior,s);
  process.stdout.write("AMF FULL PROGRAM "+x.earned+"/100 (delta "+changes.delta+")\n"+progressBar(x.earned)+"\n");
  process.stdout.write("New gate IDs: "+(changes.newGates.join(",")||"NONE")+"; regressions: "+(changes.regressed.join(",")||"NONE")+"\n");
  for(const g of x.groups)process.stdout.write(g.id+": "+g.earned+"/"+g.weight+"; milestones "+g.completed+"/"+g.total+"\n");
  process.stdout.write("Formal workstreams closed "+x.closedWorkstreams+"/6; release is NOT authorized.\n");
}
