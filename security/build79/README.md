# Build 79 — complete synthetic 19-table fixture design and hosted isolation evidence

**Date:** 13 November 2026 (Asia/Kolkata)  
**Repository:** `amfsynergyvision7/synergy-recruit-hub`  
**PR:** #12, DRAFT / release HOLD  
**Only live target:** dedicated nonproduction `dhlhlasnaapzckjyvffn`  
**No production or staging SQL writes, no `main` merge, no financial/email/sync workflows activated.**

## Work actually completed

### 1. Hosted pre-Auth full-fixture inventory: verified PASS

The committed `full-fixture-preauth.readonly.sql` was executed read-only in the actual hosted nonproduction project, and returned:

```json
{
 "tables":19, "enforced_rls_tables":19,
 "views":13, "invoker_views":13,
 "columns":239, "constraints":75,
 "app_triggers":32, "enabled_app_triggers":0,
 "auth_users":0, "app_policies":0,
 "inventoried_tables":19, "application_fixture_rows":"0",
 "app_functions":16, "exposed_app_functions":0,
 "hardened_function_matches":2,
 "live_structural_gate":"BUILD79_FULL_FIXTURE_PREAUTH_LAB_PASS_NOT_PERMISSION_TO_PROVISION"
}
```

It checks every one of the 19 real application table row counts individually, without reading or exporting personal/business records. It pins the two Build78-hardened function definitions and confirms all application triggers remain disabled.

### 2. Complete additional 16-table synthetic fixture composer + tests

`compose-and-seed-remaining-fixture.mjs` extends Build78's *prepared but unexecuted* initial 8 profiles + 8 roles + 2 candidates. Its ordered additional 16 table groups cover all remaining `public` CRM tables, and the resulting 19-table synthetic blueprint matches the historical Build41 **15 admin-case row counts**. It uses only invented `example.invalid` emails, separate fictional client/company/job records, and the nine independently generated Auth Admin UUIDs. The two base candidate IDs are exactly the recruiter GoTrue IDs for slots 02 and 03, as required by the existing hosted UAT runner.

It provides:
- Zero active workflow rules, zero outbound Google connections, no scheduled interview, no candidate joined/offer effective status, no issued invoice, no delivered notification/email, and no sync executed.
- Explicit override of risky source defaults, respecting seven real source CHECK constraints (including `workflow_rules.action_type='notify'` with `is_active=false`, and positive Sheets counters even though sync remains disabled).
- Exact ordered cross-table references for clients, jobs, submissions, interviews, offers and zero-value draft-like synthetic billing.
- Server-side Auth Admin nine-user proof, exact 8/8/2 base presence, all 16 remaining tables verifiably empty before insert, `id`-scoped reverse cleanup on failure, and zero sensitive data written to logs.
- Source-only *preparation*: the executor is gated by `AMF_UAT_EXTENDED_SEED_MODE=EXECUTE`, `AMF_UAT_EXTENDED_SEED_ACK=I_ACCEPT_SYNTHETIC_16_TABLE_FIXTURE_INERT_NONPROD_ONLY`, and independently verified `AMF_UAT_PRESEED_READBACK_PASS`; a credential manager must supply the nonprod service key and existing nine-user mapping. The latest Build79 checker is technical evidence, not an independent signoff.

**Not executed:** no GoTrue users yet, and zero application rows exist. This design is **not production migration SQL**, not a full functional RLS policy deployment, and not 135 accepted hosted cases.

### 3. Live source-catalog type and referential contract

`hosted-catalog-source-snapshot.json` was generated from the **actual isolated nonproduction PostgreSQL catalog** by read-only queries. Source metadata includes 19 tables, 239 column name/type/nullability records, 42 foreign-key references, and seven CHECK constraints. It contains no candidate, client or Auth rows. `live-source-column-fk-check-contract.test.mjs` checks all 19 table batches supply every required NOT NULL source column, contain no invented columns, resolve all 42 FKs to an invented in-memory row/GoTrue mapping, satisfy all seven CHECK invariants, and agree with the exact 15 historical admin read-count expectations. This is source-shape checking, not evidence that the hosted fixture has been seeded.

### 4. Actual outbound isolation audit: verified PASS

The committed `outbound-isolation.readonly.sql` was executed on the nonproduction project. It returned:

```json
{
 "publish_all_publications":0, "published_app_tables":0,
 "storage_buckets":0, "storage_objects":0,
 "outbound_extensions":0,
 "application_functions_with_obvious_outbound_keywords":0,
 "enabled_application_triggers":0,
 "isolation_gate":"BUILD79_PREAUTH_OUTBOUND_CATALOG_PASS_EDGE_LIST_SEPARATE"
}
```

Supabase Edge Function list separately returned `[]` (zero deployed functions). This is a bounded catalog/keyword audit, not a complete external egress proof. It supports the isolated fixture plan; it does not authorize sending mail, publishing, syncing or issuing financial records.

### 5. Complete 38-row post-seed integrity check — created and actually run (expected HOLD)

`full-synthetic-postseed.readonly.sql` independently checks all 19 source table counts, **exactly 38 invented application rows** (eight profiles, eight user roles, two recruiter candidates, and 20 additional records across the remaining 16 tables), nine genuine `example.invalid` Auth identities, eight matched profiles, exactly one unprofiled/unroled ninth user, seven role-status groups, candidate ID/ownership, linked jobs/submissions/interviews, and inert finance/email/Sheets/sync/workflow/publication controls. It returns only numeric aggregates, never emails, user UUIDs, passwords or personal rows.

This query was **ACTUALLY executed read-only** in the currently empty hosted nonproduction project. It correctly returned `HOLD_BUILD79_FULL_SYNTHETIC_POSTSEED_INTEGRITY`: 19/19 table groups mismatch the expected seeded counts, zero application rows, zero Auth users and zero historical signed UAT acceptance. This is expected until the separately protected Auth Admin and full fixture stages are executed; **no user/data creation was implied or performed**.

Two new CI source-contract tests enforce the read-only 38-row integrity and external-effect requirements. Total Build79 new tests are now **19** (eight fixture composer/mocked seeding; six catalog integrity; three review-only policy; two postseed gate).

### 6. Proposed minimal RLS role pilot — NOT executed

`minimal-three-policy-review-only.rollback.sql` proposes self-profile/self-role access and active approved recruiter-only candidate reads, with anon denied and no write grants. It is intentionally incomplete for the full historical 135-case admin and cross-table matrix. Attempted hosted rehearsal was **blocked by an execution safety control**. We did **not** retry via an alternate SQL path or apply this policy. All public application policies in nonproduction remain zero. Three new source-only CI tests verify its narrow, `ROLLBACK`-only nature. Reviewer approval and a permitted execution context would be needed before any live pilot.

## CI, release status and follow-up

Four Build79 Node test files add **19 tests** covering fixture composition, mocked hosted setup failures and cleanup, live-catalog 239-column/42-FK/7-CHECK consistency and review-only RLS guards. Both existing fast and full workflows were extended to run them on the PR branch. Confirm each run's own exact HEAD SHA; a cancelled earlier run or the intentionally failing `production-release-hold` job does not indicate a substantive engineering failure.

**Formal counters unchanged:** 0/48 accepted live security remediations, 0/140 independently signed hosted UAT cases, 0/9 signed release gates, 0/6 programme workstreams formally closed. PR #12 remains DRAFT/unmerged with zero independent reviews; earlier repository rulesets query showed `[]`.

**Next critical path:**
1. Approved server-only nonproduction Auth Admin executor with protected key creates exactly nine invented `example.invalid` users (never direct SQL to `auth.users`).
2. Independently verify nine users, disabled triggers and current outbound isolation; run Build78 8/8/2 base seeder, recheck nine/eight/eight with `security/build75/isolated-hosted-postseed.readonly.sql`.
3. Independently review and run the additional 16-table synthetic-only fixture. Verify row counts, foreign keys, no workstream side effects, published table count, no live connections and authentication scope.
4. Review and implement full admin/recruiter/pending/inactive/viewer/finance/operations authorization for 135 historical read cases; execute genuine signed GoTrue/PostgREST/browser read-only UAT. Five historical write cases remain separately isolated and authorization-gated.
5. Independently sign UAT, branch protection/code review, recovery/PITR proof, HR/legal/privacy/finance governance and all nine release gates; after those steps, review and apply 48 production remediations and then authorize `main` merge.

**Conditional forecast unchanged:** approximately **5–10+ substantive CRM release iterations** and **15–30+ complete-programme iterations** after Auth Admin availability and independent review dependencies can be satisfied. No invented percentage of overall completion or countdown while 0/140 and 0/9 remain.

**Evidence sources:** this directory's source files and GitHub Actions CI; Issue #13 hosted UAT; Issue #14 governance. No secrets, real business records or identifying user credentials are included.
