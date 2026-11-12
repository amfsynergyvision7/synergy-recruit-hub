# Build 69 — verified hosted-readiness HOLD, source-shaped synthetic fixture safety and recruiter-view semantics

**DRAFT / NON-EXECUTABLE PREPARATION / NO MAIN MERGE OR LIVE DB WRITE / NO FINANCIAL ACTIVATION**

## New genuine nonproduction observation

Ran `security/build69/hosted-fixture-readiness.readonly.sql` on the existing dedicated nonproduction Supabase project `dhlhlasnaapzckjyvffn` (SELECT only). Results on 12 November 2026:

| Scope prerequisite | Count |
|---|---:|
| Auth users | 0 |
| Public tables | 0; 19 required |
| Public views | 0; 13 required |
| Expected tables with RLS | 0 |
| Expected `security_invoker` views | 0 |
| Candidate-stage-history RLS policies | 0 |
| Readiness | `HOLD_NONPRODUCTION_SCHEMA_OR_SECURITY_PREREQUISITES_ABSENT` |

This is an **actual hosted-readiness observation**, not 140-case genuine hosted UAT. This readiness gate is a single catalog/count SELECT and requires the final nonproduction security shape (RLS enabled for all 19 tables, zero anon-TRUNCATE, all 13 views invoker-safe, no anonymous view reads, stage-history policy) before even considering a schema preflight pass. A hypothetical schema pass would still need independently approved synthetic fixtures, role checks, source-policy review and real signed testing.

## New source-verified fixture constraints

A **read-only metadata audit of live production** discovered **29 noninternal application triggers** and **26 foreign keys** across the **12 base-table types** identified in Build68's view dependency plan. `fixture-source-catalog.json` records the exact table names, required non-default columns, trigger names/functions, FK relationships and ten lifecycle/workflow-related triggers flagged for extra review. No trigger functions were executed and no production or customer records inspected.

`synthetic-fixture-blueprint.json` is a **non-executable and unapproved** FK-topologically-ordered plan to satisfy minimal conceptual positive controls. It fixes an important negative test fixture constraint: **nine invented GoTrue users but only EIGHT profile/role records**; the ninth must remain intentionally unprofiled. The historical 135-case matrix expects two recruiter-specific candidate IDs. The blueprint proposes **20 illustrative source-table rows** in 12 types, not a statement that 20 records suffice for every view condition or release test.

Critical defaults revealed by actual catalog metadata:
- `public.workflow_rules.is_active` defaults to **true** — any invented workflow-rule row must explicitly specify `false` and still require a separately reviewed isolation plan. Never accidentally activate workflow notifications/actions.
- `public.email_log.status` defaults to **'sent'** — any invented mail log must explicitly record a safe non-sent synthetic state and must not trigger an actual message.
- `offers_stage_billing_trigger`, `workflow_rules_trigger`, candidate stage, interview, submission and billing trigger paths mean even minimal fixture INSERTs could perform consequential side effects. **No host provisioning is authorized by these artifacts.** Never disable triggers in production/staging.

The safety contract test checks all 29 trigger inventories (including ten high-risk), 26 FK ordering constraints, required source columns, the nine-identity/eight-profile asymmetry and non-executable workflow/email controls. No sensitive customer or candidate values are present in the manifest.

## Newly verified recruiter view source concern

A catalog-only `pg_get_viewdef` audit fingerprinted the five recruiter-facing views:
`available_recruiters`, `recruiter_performance`, `recruiter_performance_with_names`, `recruiter_stats`, `recruiter_summary`. **All five filter approved profiles but lack explicit active flags and recruiter-role predicates.** Thus an approved nonrecruiter or an inactive, still-approved recruiter could qualify under these view definitions (subject to the caller's RLS and grants). This is a genuine **source-semantic compatibility/security finding**, not proof that particular individuals appear in actual responses.

`recruiter-view-scope-review.md` contains a fenced, **non-executable** correction example for `available_recruiters` and scoped review recommendations for the four metrics views. Independent recruitment-owner and security reviews, application consumer reconciliation, a replacement view-fingerprint review of all 13 source views and an isolated rollback-only integration test are prerequisites before any SQL change. The existing Build59 source fingerprint is deliberately left unchanged and enforced.

## Governance and next gates

1. Independently review the 19-table/13-view release-candidate schema, view semantics and all 29 triggers (particularly financial and workflow handlers), then prepare a separately authorized synthetic-only provisioning plan with no external side effects.
2. Provision exactly nine invented GoTrue test accounts, eight matching profile/role records and one deliberately unprofiled account, with secure pinned UUID maps. Seed invented-only candidate/client/job/offer/invoice and supporting records ONLY in an independently approved isolated environment, after trigger risk isolation and financial/legal review. Never copy real data.
3. Confirm all 16 seeded positive HEAD controls and 20 anonymous HEAD controls, 135 historical role/table cases and five separately controlled write cases, then the missing current table/view/function/browser scenarios.
4. Complete independent reviewer sign-off, financial/retention/legal decisions, backup/restore/PITR acceptance, source-fingerprint and app compatibility review, `main` protection and nine signed security release gates.

Formal programme counters stay **0/48** live production remediations accepted, **0/140** genuine hosted cases independently accepted, **0/9** security signoffs, **0/6** six-workstream final acceptances. Draft PR #12 and `production-release-hold` remain active; no production/staging writes, real candidate downloads, activation, external communications, `main` merge or deployment.

**Indicative conditional remaining build estimates:** 6–10+ further meaningful builds for secured CRM `main` merge and 16–28+ for full six-workstream Command Center. These are approximate iterations, not monetary bills or deadlines.


## Build69 full-19-table expansion and actual hosted observation

An additional **read-only** production catalogue audit covered the **seven** CRM tables outside the 12-table Build68 positive-view source plan: `audit_logs`, `candidate_activities`, `google_integrations`, `integrations`, `notifications`, `sync_logs`, `user_roles`. It found **three additional application triggers and zero new FK constraints**. The complete public fixture source scope is therefore **19 tables / 32 application triggers / 26 source FKs**.

- `additional-seven-source-catalog.json` fingerprints these seven table column requirements, the three triggers, and source defaults. `google_integrations.auto_sync_enabled` and `integrations.auto_sync` default to false but should be explicitly false in any approved synthetic fixture; `sync_logs.status` defaults to `'success'` and must not be allowed to imply a real sync occurred.
- `complete-19-fixture-blueprint.json` is a **non-executable, unapproved**, 19-table FK-ordered candidate fixture plan with **34 illustrative source-table rows**, plus **nine** invented hosted Auth users, **eight** corresponding profiles and **eight** role records. The deliberately unprofiled ninth account is essential to the historical negative authorization tests. The blueprint is an illustrative starting point, not proof that 34 records satisfy every historical count, filtered view and current-scope policy.
- `complete-19-fixture-contract.test.mjs` checks exact 19-table coverage, 32 **table-qualified** trigger identities (trigger names alone repeat on multiple tables), the 26 FK ordering constraints, all required source columns, identity/profile asymmetry, inactive workflow rules, unsent email logs, disabled integrations and no actual writes.
- `hosted-readiness-observation.json` stores the **actual live, SELECT-only** dedicated synthetic Supabase result showing zero Auth users, zero public tables/views and a `HOLD_NONPRODUCTION_SCHEMA_OR_SECURITY_PREREQUISITES_ABSENT` status. The source SQL blob SHA is included. This is not formal UAT completion.
- New contracts were wired into both the fast and full GitHub security workflows. A first 19-table test run exposed an incorrect test assumption that trigger names were globally unique; the test was corrected to use **table name plus trigger name**. This was a test-only correction, not a live database change.

**Remaining limitations:** the full fixture still requires source-verified final release policies/functions/views, a reviewed trigger isolation design, safe approval of any independently provisioned synthetic GoTrue users, and genuine hosted acceptance. No staging/production writes, credential sharing, external messaging, finance activation, main-branch merge or deployment is authorized by this artefact. Historical formal counters remain `0/48`, `0/140`, `0/9`, `0/6`.
