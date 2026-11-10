# CRM security — consolidated evidence-based acceptance register
Date: 2026-11-10
Branch: `security/build2-step35e-integration-draft-20261110`
Disposition: **DRAFT INTEGRATION CI ACCEPTED; RELEASE HOLD**

## Verified GitHub evidence at checkpoint 1b9febc7
| ID | Requirement | Evidence | Status |
|---|---|---|---|
| CI-01 | Combined Step 35E source security gate | GitHub Actions run 42762378377, successful | PASS |
| CI-02 | Application build and TypeScript | Build 2 run 42762378294, application-typescript-check successful | PASS |
| CI-03 | Build 2 offline security and nine release-gate holds | Build 2 run 42762378294, offline-security-tests successful | PASS |
| CI-04 | Disposable PostgreSQL SQL integration | Build 2 run 42762378294, isolated-postgres-view-rls successful | PASS |
| SRC-01 | Integration includes Step 35E + Build 2 change sets | Integration commit 5ffe857c; 20 Step 35E changed paths applied | PASS (source composition only) |
| SRC-02 | Current main reconciliation | GitHub compare: integration ahead 258, behind 27, 167 changed files | BLOCKED |
| DB-01 | Fresh complete current metadata-only inventory | Historical inventory exists; not refreshed or exhaustively reviewed in this batch | OPEN |
| DB-02 | Approved complete 15-table RLS, grants, views and RPC migration | Existing drafts explicitly partial/review-only | BLOCKED |
| DB-03 | No self-approval, role escalation, ownership reassignment or data leakage | Synthetic checks only; live-schema-equivalent negative suite not completed | OPEN |
| APP-01 | CRM role-specific browser workflows and regressions | No combined browser test evidence | OPEN |
| APP-02 | End-to-end Google Drive import and candidate workflow under security controls | Not validated; external AI remains hard-denied | OPEN |
| SEC-01 | Independent security review and advisor disposition | Not completed | OPEN |
| OPS-01 | Backup restore and reviewed reverse migration in approved isolated environment | Transactional synthetic rollback only; no actual restore proof | BLOCKED |
| REL-01 | Explicit production change authorization, maintenance window, rollback owner | Not requested/executed because technical gates remain open | BLOCKED |
| REL-02 | Production deploy, post-deploy security verification | Prohibited until REL-01 | BLOCKED |

## CI evidence and boundaries
The four CI checks passed on the **same source SHA** `1b9febc724ec1034fff9b9224d719ecce789ff47`. Build 2 PostgreSQL jobs use disposable Postgres 17 synthetic data. The workflow's successful release-gate test deliberately verifies that **all nine production conditions remain blocked**. Green CI is therefore **not** release authorization.

At this checkpoint, comparison against `main` is **258 ahead and 27 behind**. The earlier non-overlapping paths comparison was relative to main and does not establish semantic compatibility with those 27 main commits.

## Batch follow-through and decision gates
1. **Current-main reconciliation (draft only):** examine the 27 commits, their changed paths, auth and workflow dependencies; create an isolated successor integration branch; resolve conflicts without touching main. Retest the exact new SHA.
2. **Database contract:** refresh only approved metadata (no candidate/customer records), enumerate 15 table operations, all view definitions, RPC signatures, grants, triggers and dependent routes. Resolve profile and user_roles escalation. Do not run migration SQL on staging or production.
3. **Offline tests:** expand disposable Postgres tests to mirror actual current metadata; test anon, inactive/pending, recruiter own/other, operations, finance/viewer, admin; all CRUD, exports, joins, RPC, views, side effects and negative paths. Record any schema mismatch.
4. **Recovery:** create reviewed forward and reverse migrations, backup/restore runbook and exercise only on approved isolated synthetic environment. The existing transaction rollback test does not satisfy actual restore.
5. **Independent review:** evaluate advisor findings individually, test application browser workflows, document exceptions, then prepare a specific CEO release decision with risks, evidence and rollback.
6. **No execution before approval:** no merge, staging/production database write, deploy, real-record read, external AI/SMTP enablement or financial workflow activation.

## Program-wide evidence ledger (post-CRM release)
| Workstream | Acceptance proof required | Current disposition |
|---|---|---|
| Company Knowledge Base and team assistant | Approved-source/version ledger, permission tests, citation quality, owner sign-off | Not assessed in this batch |
| AI Lead Discovery and prospect research | Lawful sources, dedupe, provenance, human-reviewed precision and CRM consent gates | Not assessed in this batch |
| AI Marketing, Branding and Creative Studio | Approved brand source, factual claims review, creative acceptance, publishing controls | Not assessed in this batch |
| Sales outreach and email drafting | Opt-in/source verification, approved copy, deliverability tests, human send gate | Outbound remains blocked |
| CRM integrations and recruitment automation | CI-01–04 plus DB/APP/OPS/REL gates above | **Draft CI passed; release blocked** |
| Business intelligence and dashboards | Metric definitions, authorized data access, reconciled sample calculations, owner sign-off | Not assessed in this batch |

This register reports evidence-backed status, not invented completion percentages.
