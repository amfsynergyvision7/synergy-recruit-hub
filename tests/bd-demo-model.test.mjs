// Run after npm install: node --test tests/bd-demo-model.test.mjs
// Uses the existing TypeScript devDependency; no external data or network calls.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../src/lib/bd-demo-model.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const model=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const {seed,addOrganization,addContact,addOpportunity,addTask,moveOpportunity,toggleTask,summarize,validateOpportunity}=model;
test("three opportunity types are represented",()=>assert.equal(new Set(seed.opportunities.map(o=>o.type)).size,3));
test("duplicate organization rejected",()=>assert.throws(()=>addOrganization(seed,{...seed.organizations[0],id:"new"}),/already exists/));
test("new organization accepted",()=>assert.equal(addOrganization(seed,{id:"new",name:"Example New",city:"",industry:"",owner:"Demo"}).organizations.length,4));
test("contact requires valid organization",()=>assert.throws(()=>addContact(seed,{id:"x",organizationId:"unknown",name:"A",title:"",email:""}),/valid organization/));
test("contact email validated",()=>assert.throws(()=>addContact(seed,{id:"x",organizationId:"org-1",name:"A",title:"",email:"bad"}),/Invalid email/));
test("opportunity requires owner",()=>assert.equal(validateOpportunity({...seed.opportunities[0],owner:""},seed),"Owner is required"));
test("opportunity requires valid organization",()=>assert.throws(()=>addOpportunity(seed,{...seed.opportunities[0],id:"new",organizationId:"missing"}),/valid organization/));
test("opportunity stage moves immutably",()=>{const next=moveOpportunity(seed,"opp-1","won");assert.equal(next.opportunities[0].stage,"won");assert.equal(seed.opportunities[0].stage,"qualified")});
test("invalid stage rejected",()=>assert.throws(()=>moveOpportunity(seed,"opp-1","hacked"),/Invalid stage/));
test("task requires related opportunity",()=>assert.throws(()=>addTask(seed,{id:"x",opportunityId:"missing",title:"Follow up",due:"2026-11-10",done:false,owner:"Demo"}),/Unknown opportunity/));
test("task toggle immutable",()=>{const x=toggleTask(seed,"task-1");assert.equal(x.tasks[0].done,true);assert.equal(seed.tasks[0].done,false)});
test("overdue summary calculated",()=>assert.equal(summarize(seed,"2026-11-14").overdue,2));

test("invalid calendar dates rejected",()=>assert.throws(()=>addTask(seed,{id:"x",opportunityId:"opp-1",title:"Follow up",due:"2026-99-99",done:false,owner:"Demo"}),/Valid task/));
test("task missing owner rejected",()=>assert.throws(()=>addTask(seed,{id:"x",opportunityId:"opp-1",title:"Follow up",due:"2026-11-10",done:false,owner:""}),/Valid task/));

test("duplicate contact emails rejected case-insensitively",()=>assert.throws(()=>addContact(seed,{id:"new",organizationId:"org-3",name:"Demo",title:"",email:"DEMO-A@EXAMPLE.INVALID"}),/already exists/));
test("unknown task cannot be toggled",()=>assert.throws(()=>toggleTask(seed,"missing"),/Unknown task/));
test("valid follow-up task can be added",()=>assert.equal(addTask(seed,{id:"new",opportunityId:"opp-1",title:"Call",due:"2026-11-15",done:false,owner:"Demo"}).tasks.length,3));

test("organization ID collision rejected",()=>assert.throws(()=>addOrganization(seed,{...seed.organizations[0],name:"Another Organization"}),/ID must be unique/));
test("contact ID collision rejected",()=>assert.throws(()=>addContact(seed,{...seed.contacts[0],email:"different@example.invalid"}),/ID must be unique/));
test("opportunity ID collision rejected",()=>assert.throws(()=>addOpportunity(seed,{...seed.opportunities[0],title:"Another Opportunity"}),/ID must be unique/));
test("task ID collision rejected",()=>assert.throws(()=>addTask(seed,{...seed.tasks[0],title:"Another task"}),/ID must be unique/));
