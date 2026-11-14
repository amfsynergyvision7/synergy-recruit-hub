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
  return {earned,remaining:100-earned,milestones_total:ids.size,
    completed_milestones:[...states.values()].filter(x=>x.complete).length,
    groups,closedWorkstreams};
}
export function progressBar(earned,width=30){
  const filled=Math.round(width*earned/100);
  return "█".repeat(filled)+"░".repeat(width-filled);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const rubric=readLocal("v1-rubric.json");
  const s=readLocal("current.json"),prior=readLocal("build119-retrospective-baseline.json");
  const x=evaluate(rubric,s),p=evaluate(rubric,prior);
  process.stdout.write("AMF FULL PROGRAM "+x.earned+"/100 (delta "+(x.earned-p.earned)+")\n"+progressBar(x.earned)+"\n");
  for(const g of x.groups)process.stdout.write(g.id+": "+g.earned+"/"+g.weight+"; milestones "+g.completed+"/"+g.total+"\n");
  process.stdout.write("Formal workstreams closed "+x.closedWorkstreams+"/6; release is NOT authorized.\n");
}
