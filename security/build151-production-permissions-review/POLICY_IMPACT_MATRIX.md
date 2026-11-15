# Build 153 — RLS policy impact and UAT ownership matrix

**DRAFT REVIEW ONLY — DO NOT EXECUTE SQL, MERGE OR DEPLOY.**

Source-derived comparison: **67 existing policies on 18 tables → 35 proposed policies on 19 tables**. 15 broad public ALL policy declarations are proposed for removal. **7 tables lose at least one declared policy operation; 1 gain one.** No live permissions changed.

**Interpretation limit:** Operation coverage below means *policy declarations* only, not actual SQL privileges or successful role-level access. PostgreSQL ACLs, column grants, SECURITY DEFINER RPCs, policy predicates and triggers can change effective behavior. Owner and UAT suggestions are proposed routing, **not approved company policy, completed UAT, or signoffs**.

| Table | Old → proposed rules | Removed declared operations | New declared operations | Reviewer / proposed UAT scenario |
|---|---:|---|---|---|
| `app_settings` | 2 → 1 | UPDATE | — | **CRM administrator and security reviewer**: Check public branding read, admin settings update, and private Drive folder isolation |
| `audit_logs` | 3 → 1 | INSERT, UPDATE, DELETE | — | **Security and audit owner**: Verify audit events are created by trusted paths and admin audit reading remains authorized |
| `billing` | 5 → 2 | — | — | **Finance and legal reviewer**: Verify invoice read/write authorization, payment states, and no automated financial activation |
| `candidate_activities` | 2 → 1 | INSERT, UPDATE, DELETE | — | **Recruitment operations owner**: Verify recruiter activity events are recorded through an approved trusted write path |
| `candidate_stage_history` | 0 → 1 | — | SELECT | **Recruitment operations owner**: Verify only authorized candidate-stage history can be read |
| `candidates` | 5 → 4 | — | — | **Recruitment lead and privacy owner**: Verify assignment isolation, candidate create/update, stage changes, and sensitive fields |
| `clients` | 5 → 2 | — | — | **Sales and CRM owner**: Verify client record create/update/read/delete and authorization boundaries |
| `email_log` | 2 → 1 | INSERT | — | **Communications and security owner**: Verify email audit entries are created by a trusted path without enabling external outreach |
| `google_integrations` | 4 → 1 | — | — | **Integration and security owner**: Verify Google integration ownership, safe configuration and disconnected account boundaries |
| `integrations` | 3 → 1 | — | — | **Integration and security owner**: Verify admin-only integration settings and no accidental public access |
| `interviews` | 5 → 2 | — | — | **Recruitment operations owner**: Verify interview scheduling, updates and assigned recruiter visibility |
| `job_openings` | 5 → 4 | — | — | **Recruitment and sales owner**: Verify job creation, status/priority updates and unauthorized modification denial |
| `notifications` | 4 → 3 | DELETE | — | **Operations and security owner**: Verify notification reads, is_read updates and deletion behavior |
| `offers` | 5 → 2 | — | — | **Recruitment, finance and legal reviewer**: Verify offer lifecycle authorization while financial issuance remains inactive |
| `profiles` | 5 → 3 | INSERT | — | **Identity and HR owner**: Verify self-profile RPC and administrator RPC; prohibit direct unauthorized profile writes |
| `submissions` | 5 → 2 | — | — | **Recruitment and client account owner**: Verify submission creation, reading and authorized status transitions |
| `sync_logs` | 3 → 1 | INSERT, UPDATE, DELETE | — | **Integration and operations owner**: Verify trusted sync-log writes, monitoring reads and job failure recording |
| `user_roles` | 3 → 2 | — | — | **Identity and security owner**: Verify role administration RPC, last-admin safeguards and no direct browser role edits |
| `workflow_rules` | 1 → 1 | — | — | **Operations and finance/security reviewer**: Verify admin rule maintenance, deny unauthorized edits and keep finance activation off |

## Review questions requiring signed decisions

- **Data creation and audit reliability:** `audit_logs`, `candidate_activities`, `email_log`, and `sync_logs` lose declared direct INSERT policy coverage. Identify intended service/RPC write paths, confirm event persistence and avoid logging real personal data in test fixtures.
- **Identity and profile changes:** `profiles` loses declared direct INSERT coverage, while `user_roles` remains covered by a proposed ALL policy but browser-facing direct writes are explicitly revoked. Verify both account-management RPC contracts, last-admin safeguards and self-service profile flows.
- **Settings and notifications:** `app_settings` loses declared UPDATE policy coverage; `notifications` loses DELETE. Confirm which workflows should remain possible and which must be denied.
- **New read policy:** `candidate_stage_history` has no old policy in this catalog and gains one proposed SELECT policy. Confirm historical visibility and assignment restrictions.
- **Financial safety:** `billing`, `offers` and `workflow_rules` still need finance/legal/security owners to approve intended operations. Do not activate monetary workflows or claim policy acceptance.
- **Permission boundary:** Proposed ACL changes cover table/column privileges, 13 views and 16 privileged functions. Verify combined effects, not only these policy declarations.
- **Deployment readiness:** Requires separate signed browser/API UAT (140 cases), real independent security review, backups/PITR restore rehearsal, protected `main`, and all 9 release signoffs.

**Formal status: HOLD. No policies applied, no independent table signoffs, 0/48 production permission objects accepted.**
