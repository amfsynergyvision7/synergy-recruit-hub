// Build153: source-only parsing. DO NOT connect to database or execute SQL.
// A proposed policy command does not prove effective access; see impact disclaimer.
export const UAT_BY_TABLE=Object.freeze({
  "app_settings": {
    "owner": "CRM administrator and security reviewer",
    "case": "Check public branding read, admin settings update, and private Drive folder isolation"
  },
  "audit_logs": {
    "owner": "Security and audit owner",
    "case": "Verify audit events are created by trusted paths and admin audit reading remains authorized"
  },
  "billing": {
    "owner": "Finance and legal reviewer",
    "case": "Verify invoice read/write authorization, payment states, and no automated financial activation"
  },
  "candidate_activities": {
    "owner": "Recruitment operations owner",
    "case": "Verify recruiter activity events are recorded through an approved trusted write path"
  },
  "candidate_stage_history": {
    "owner": "Recruitment operations owner",
    "case": "Verify only authorized candidate-stage history can be read"
  },
  "candidates": {
    "owner": "Recruitment lead and privacy owner",
    "case": "Verify assignment isolation, candidate create/update, stage changes, and sensitive fields"
  },
  "clients": {
    "owner": "Sales and CRM owner",
    "case": "Verify client record create/update/read/delete and authorization boundaries"
  },
  "email_log": {
    "owner": "Communications and security owner",
    "case": "Verify email audit entries are created by a trusted path without enabling external outreach"
  },
  "google_integrations": {
    "owner": "Integration and security owner",
    "case": "Verify Google integration ownership, safe configuration and disconnected account boundaries"
  },
  "integrations": {
    "owner": "Integration and security owner",
    "case": "Verify admin-only integration settings and no accidental public access"
  },
  "interviews": {
    "owner": "Recruitment operations owner",
    "case": "Verify interview scheduling, updates and assigned recruiter visibility"
  },
  "job_openings": {
    "owner": "Recruitment and sales owner",
    "case": "Verify job creation, status/priority updates and unauthorized modification denial"
  },
  "notifications": {
    "owner": "Operations and security owner",
    "case": "Verify notification reads, is_read updates and deletion behavior"
  },
  "offers": {
    "owner": "Recruitment, finance and legal reviewer",
    "case": "Verify offer lifecycle authorization while financial issuance remains inactive"
  },
  "profiles": {
    "owner": "Identity and HR owner",
    "case": "Verify self-profile RPC and administrator RPC; prohibit direct unauthorized profile writes"
  },
  "submissions": {
    "owner": "Recruitment and client account owner",
    "case": "Verify submission creation, reading and authorized status transitions"
  },
  "sync_logs": {
    "owner": "Integration and operations owner",
    "case": "Verify trusted sync-log writes, monitoring reads and job failure recording"
  },
  "user_roles": {
    "owner": "Identity and security owner",
    "case": "Verify role administration RPC, last-admin safeguards and no direct browser role edits"
  },
  "workflow_rules": {
    "owner": "Operations and finance/security reviewer",
    "case": "Verify admin rule maintenance, deny unauthorized edits and keep finance activation off"
  }
});

export function buildPolicyImpact(legacyCatalog, proposalSql){
 if(!legacyCatalog||legacyCatalog.count!==67||legacyCatalog.tables!==18||!Array.isArray(legacyCatalog.policies)||legacyCatalog.policies.length!==67)
  throw new Error("Legacy 67-policy catalog is incomplete");
 const pattern=/^CREATE POLICY\s+([a-z_][a-z0-9_]*)\s+ON\s+public\.([a-z_][a-z0-9_]*)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+TO\s+([a-z_,]+)\b/gm;
 const proposed=[...proposalSql.matchAll(pattern)].map(m=>({name:m[1],table:m[2],command:m[3],role:m[4]}));
 if(proposed.length!==35||(proposalSql.match(/^CREATE POLICY\b/gm)||[]).length!==35)
  throw new Error("Proposed policy count or grammar changed; review required");
 if(new Set(proposed.map(p=>p.table+"/"+p.name)).size!==35)
  throw new Error("Proposed policy names are not unique per table");
 const legacy=legacyCatalog.policies.map(x=>({table:x.tablename,name:x.policyname,command:x.cmd,role:x.roles,qual:x.qual,check:x.with_check,permissive:x.permissive}));
 if(new Set(legacy.map(x=>x.table+"/"+x.name)).size!==67)
  throw new Error("Legacy policy identities are ambiguous");
 const oldTables=new Set(legacy.map(p=>p.table)),newTables=new Set(proposed.map(p=>p.table));
 const names=[...new Set([...oldTables,...newTables])].sort();
 if(names.length!==19||newTables.size!==19||oldTables.size!==18)
  throw new Error("Nineteen-table impact scope changed");
 const operations=["SELECT","INSERT","UPDATE","DELETE"];
 const expanded=policies=>new Set(policies.flatMap(p=>p.command==="ALL"?operations:[p.command]));
 const rows=names.map(table=>{
  const previous=legacy.filter(p=>p.table===table),next=proposed.filter(p=>p.table===table);
  const oldOps=expanded(previous),newOps=expanded(next),review=UAT_BY_TABLE[table];
  if(!review||next.length===0)throw new Error("No proposed rule or review owner for "+table);
  const removed=operations.filter(op=>oldOps.has(op)&&!newOps.has(op));
  const added=operations.filter(op=>newOps.has(op)&&!oldOps.has(op));
  return {
   table,legacy_policy_count:previous.length,proposed_policy_count:next.length,
   legacy_policy_names:previous.map(p=>p.name).sort(),
   proposed_policy_names:next.map(p=>p.name).sort(),
   legacy_declared_commands:operations.filter(op=>oldOps.has(op)),
   proposed_declared_commands:operations.filter(op=>newOps.has(op)),
   removed_policy_command_declarations:removed,
   new_policy_command_declarations:added,
   removed_universal_all:previous.filter(p=>p.name==="Allow all for authenticated"&&p.role==="{public}"&&p.command==="ALL"&&p.permissive==="PERMISSIVE"&&p.qual==="true"&&p.check==="true").length,
   priority:removed.length||["billing","offers","user_roles","profiles","workflow_rules"].includes(table)?"HIGH":"STANDARD",
   suggested_reviewer:review.owner,suggested_uat:review.case,
   owner_acceptance:"NOT_RECEIVED"
  };
 });
 const prior=rows.reduce((sum,row)=>sum+row.legacy_policy_count,0);
 const future=rows.reduce((sum,row)=>sum+row.proposed_policy_count,0);
 const universal=rows.reduce((sum,row)=>sum+row.removed_universal_all,0);
 if(prior!==67||future!==35||universal!==15)throw new Error("Policy totals or universal exposure changed");
 return {
  schema_version:1,project:"AMF Synergy Vision",build:153,
  artifact:"STATIC SOURCE POLICY-COVERAGE COMPARISON — NOT AN ACCESS GRANT OR AUTHORIZATION TEST",
  release_decision:"HOLD_REVIEW_ONLY",
  explanation:"The operation sets describe declared RLS policy commands only. PostgreSQL table/column privileges, RLS predicates, triggers, SECURITY DEFINER RPCs and business workflow permissions must be independently tested. The removal of a policy command does NOT prove writes fail or imply a complete security fix.",
  summary:{
   legacy_policies:prior,proposed_policies:future,
   legacy_tables:oldTables.size,proposed_tables:newTables.size,
   reviewed_tables:rows.length,removed_universal_all_policies:universal,
   tables_with_removed_declared_operations:rows.filter(x=>x.removed_policy_command_declarations.length).length,
   tables_with_added_declared_operations:rows.filter(x=>x.new_policy_command_declarations.length).length,
   production_fixes_applied:0,owner_signed_tables:0
  },
  tables:rows
 };
}

export function renderPolicyImpact(impact){
 const s=impact.summary;
 const body=[
  "# Build 153 — RLS policy impact and UAT ownership matrix",
  "",
  "**DRAFT REVIEW ONLY — DO NOT EXECUTE SQL, MERGE OR DEPLOY.**",
  "",
  `Source-derived comparison: **${s.legacy_policies} existing policies on ${s.legacy_tables} tables → ${s.proposed_policies} proposed policies on ${s.proposed_tables} tables**. ${s.removed_universal_all_policies} broad public ALL policy declarations are proposed for removal. **${s.tables_with_removed_declared_operations} tables lose at least one declared policy operation; ${s.tables_with_added_declared_operations} gain one.** No live permissions changed.`,
  "",
  "**Interpretation limit:** Operation coverage below means *policy declarations* only, not actual SQL privileges or successful role-level access. PostgreSQL ACLs, column grants, SECURITY DEFINER RPCs, policy predicates and triggers can change effective behavior. Owner and UAT suggestions are proposed routing, **not approved company policy, completed UAT, or signoffs**.",
  "",
  "| Table | Old → proposed rules | Removed declared operations | New declared operations | Reviewer / proposed UAT scenario |",
  "|---|---:|---|---|---|"
 ];
 for(const row of impact.tables)body.push(
  `| \`${row.table}\` | ${row.legacy_policy_count} → ${row.proposed_policy_count} | ${row.removed_policy_command_declarations.join(", ")||"—"} | ${row.new_policy_command_declarations.join(", ")||"—"} | **${row.suggested_reviewer}**: ${row.suggested_uat} |`);
 body.push("","## Review questions requiring signed decisions",
  "",
  "- **Data creation and audit reliability:** `audit_logs`, `candidate_activities`, `email_log`, and `sync_logs` lose declared direct INSERT policy coverage. Identify intended service/RPC write paths, confirm event persistence and avoid logging real personal data in test fixtures.",
  "- **Identity and profile changes:** `profiles` loses declared direct INSERT coverage, while `user_roles` remains covered by a proposed ALL policy but browser-facing direct writes are explicitly revoked. Verify both account-management RPC contracts, last-admin safeguards and self-service profile flows.",
  "- **Settings and notifications:** `app_settings` loses declared UPDATE policy coverage; `notifications` loses DELETE. Confirm which workflows should remain possible and which must be denied.",
  "- **New read policy:** `candidate_stage_history` has no old policy in this catalog and gains one proposed SELECT policy. Confirm historical visibility and assignment restrictions.",
  "- **Financial safety:** `billing`, `offers` and `workflow_rules` still need finance/legal/security owners to approve intended operations. Do not activate monetary workflows or claim policy acceptance.",
  "- **Permission boundary:** Proposed ACL changes cover table/column privileges, 13 views and 16 privileged functions. Verify combined effects, not only these policy declarations.",
  "- **Deployment readiness:** Requires separate signed browser/API UAT (140 cases), real independent security review, backups/PITR restore rehearsal, protected `main`, and all 9 release signoffs.",
  "",
  "**Formal status: HOLD. No policies applied, no independent table signoffs, 0/48 production permission objects accepted.**",
  "");
 return body.join("\n");
}
