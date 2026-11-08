// Synthetic-only Business Development model. No Supabase imports or network calls.
export type OpportunityType = "recruitment_services" | "partnership" | "crm_software";
export type Stage = "identified" | "qualified" | "contacted" | "meeting" | "proposal" | "won" | "lost";
export type Organization = {id:string; name:string; industry:string; city:string; owner:string};
export type Contact = {id:string; organizationId:string; name:string; title:string; email:string};
export type Opportunity = {id:string; organizationId:string; title:string; type:OpportunityType; stage:Stage; owner:string; value:number; nextAction:string};
export type FollowUp = {id:string; opportunityId:string; title:string; due:string; done:boolean; owner:string};
export type BDState = {organizations:Organization[]; contacts:Contact[]; opportunities:Opportunity[]; tasks:FollowUp[]};
export const stages:Stage[]=["identified","qualified","contacted","meeting","proposal","won","lost"];
export const typeLabels:Record<OpportunityType,string>={recruitment_services:"Recruitment Services",partnership:"Partnerships",crm_software:"CRM Software"};
export const seed:BDState={
 organizations:[{id:"org-1",name:"Sample Horizon Services",industry:"Professional Services",city:"Kolkata",owner:"Demo User"},{id:"org-2",name:"Sample Growth Partners",industry:"Consulting",city:"Mumbai",owner:"Demo User"},{id:"org-3",name:"Sample Northstar Agency",industry:"Recruitment",city:"Bengaluru",owner:"Demo User"}],
 contacts:[{id:"con-1",organizationId:"org-1",name:"Demo Contact A",title:"HR Manager",email:"demo-a@example.invalid"},{id:"con-2",organizationId:"org-2",name:"Demo Contact B",title:"Director",email:"demo-b@example.invalid"}],
 opportunities:[{id:"opp-1",organizationId:"org-1",title:"Recruitment services introduction",type:"recruitment_services",stage:"qualified",owner:"Demo User",value:0,nextAction:"Prepare introduction"},{id:"opp-2",organizationId:"org-2",title:"Referral partnership",type:"partnership",stage:"meeting",owner:"Demo User",value:0,nextAction:"Schedule discussion"},{id:"opp-3",organizationId:"org-3",title:"CRM product discovery",type:"crm_software",stage:"identified",owner:"Demo User",value:0,nextAction:"Identify decision-maker"}],
 tasks:[{id:"task-1",opportunityId:"opp-1",title:"Review outreach draft",due:"2026-11-12",done:false,owner:"Demo User"},{id:"task-2",opportunityId:"opp-2",title:"Confirm meeting agenda",due:"2026-11-13",done:false,owner:"Demo User"}]
};
export function validateOpportunity(o:Opportunity,s:BDState):string|null{
 if(!o.title.trim())return "Opportunity title is required";
 if(!s.organizations.some(x=>x.id===o.organizationId))return "Choose a valid organization";
 if(!typeLabels[o.type])return "Invalid opportunity type";
 if(!stages.includes(o.stage))return "Invalid pipeline stage";
 if(!o.owner.trim())return "Owner is required";
 if(!Number.isFinite(o.value)||o.value<0)return "Value cannot be negative";
 return null;
}
export function validateContact(c:Contact,s:BDState):string|null{
 if(!c.name.trim())return "Contact name is required";
 if(!s.organizations.some(x=>x.id===c.organizationId))return "Choose a valid organization";
 if(c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))return "Invalid email";
 return null;
}
export function addOrganization(s:BDState,o:Organization):BDState{
 if(!o.name.trim())throw Error("Organization name is required");
 if(s.organizations.some(x=>x.name.trim().toLowerCase()===o.name.trim().toLowerCase()))throw Error("Organization already exists");
 return {...s,organizations:[...s.organizations,o]};
}
export function addContact(s:BDState,c:Contact):BDState{const e=validateContact(c,s);if(e)throw Error(e);return {...s,contacts:[...s.contacts,c]};}
export function addOpportunity(s:BDState,o:Opportunity):BDState{const e=validateOpportunity(o,s);if(e)throw Error(e);return {...s,opportunities:[...s.opportunities,o]};}
export function moveOpportunity(s:BDState,id:string,stage:Stage):BDState{
 if(!stages.includes(stage))throw Error("Invalid stage");
 if(!s.opportunities.some(o=>o.id===id))throw Error("Unknown opportunity");
 return {...s,opportunities:s.opportunities.map(o=>o.id===id?{...o,stage}:o)};
}
export function addTask(s:BDState,t:FollowUp):BDState{
 if(!t.title.trim()||!t.owner.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(t.due))throw Error("Task title, owner and date required");
 if(!s.opportunities.some(o=>o.id===t.opportunityId))throw Error("Unknown opportunity");
 return {...s,tasks:[...s.tasks,t]};
}
export function toggleTask(s:BDState,id:string):BDState{return {...s,tasks:s.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)};}
export function summarize(s:BDState,today:string){return {organizations:s.organizations.length,contacts:s.contacts.length,open:s.opportunities.filter(o=>!["won","lost"].includes(o.stage)).length,won:s.opportunities.filter(o=>o.stage==="won").length,overdue:s.tasks.filter(t=>!t.done&&t.due<today).length,pending:s.tasks.filter(t=>!t.done).length};}
