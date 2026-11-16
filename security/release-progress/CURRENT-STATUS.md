# AMF Synergy Vision — Project status

**Build 164 | 15 November 2026 | RELEASE HOLD**

## A — Official programme completion: 26/100 (26%)
**12/43 evidenced milestones; 31 open; 0/6 workstreams fully accepted; +0 accepted points in Build 164.**

The 100-point v1 rubric is frozen. Draft code, test counts and source review never independently increase formal completion.

## B–H — Official category progress

| Area | Existing workstream | Accepted points | Milestones evidenced | Status |
|---|---|---:|---:|---|
| B | Company knowledge base & team assistant | 6/12 (50%) | 3/6 | Open |
| C | AI lead discovery & research | 6/10 (60%) | 3/5 | Open |
| D | Marketing, branding & creative | 2/10 (20%) | 1/5 | Open |
| E | Sales outreach & follow-up | 2/10 (20%) | 1/5 | Open |
| F | CRM, recruitment & AI automation | 10/28 (36%) | 4/10 | Open |
| G | Business intelligence & dashboards | 0/10 (0%) | 0/5 | Open |
| H | Cross-program release & governance | 0/20 (0%) | 0/7 | Open |

The points in these seven categories sum to 26/100; category percentages are within-category values, **not extra programme points**.

## F / CRM — Ten official subcategories

| Gate | Exit criterion | State | Earned |
|---|---|---|---:|
| CRM01 | undefined | Accepted | 3/3 |
| CRM02 | undefined | Accepted | 3/3 |
| CRM03 | undefined | Accepted | 2/2 |
| CRM04 | undefined | Accepted | 2/2 |
| CRM05 | undefined | Open | 0/3 |
| CRM06 | undefined | Open | 0/2 |
| CRM07 | undefined | Open | 0/2 |
| CRM08 | undefined | Open | 0/4 |
| CRM09 | undefined | Open | 0/4 |
| CRM10 | undefined | Open | 0/3 |

## Current engineering focus: AUD under CRM09 (audit history)

**4/9 source-preparation steps evidenced; 5/9 independent/hosted/live steps still open.** This is an engineering checklist, **not an accepted security or release percentage**. CRM09 remains unaccepted at **0/48 production security remediations**.

| Step | Subcategory / acceptance work | Status | Proof or owner dependency |
|---|---|---|---|
| AUD01 | Production metadata ACL and audit RLS exposure inventoried | Source evidenced | [Evidence](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/19) |
| AUD02 | Review-only append-only ACL/RLS proposal prepared | Source evidenced | [Evidence](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/18) |
| AUD03 | Disposable PG17 role denial and audit atomicity rehearsal passed | Source evidenced | [Evidence](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43700114616) |
| AUD04 | Preliminary application and catalog producer inventories inspected | Source evidenced | [Evidence](https://github.com/amfsynergyvision7/synergy-recruit-hub/blob/439727eb6af67b4d984778312ed8411871ff4e82/security/build162-audit-access/audit-producer-inventory.readonly.sql) |
| AUD05 | Trace external, scheduled, historical, indirect and dynamic writers | Blocked / independent | Owner evidence pending |
| AUD06 | Independent DBA/security migration, backup and rollback acceptance | Blocked / independent | Owner evidence pending |
| AUD07 | Hosted real-role admin read, append-only writer and denial UAT signed | Blocked / independent | Owner evidence pending |
| AUD08 | Approved coordinated live security migration executed | Blocked / independent | Owner evidence pending |
| AUD09 | Post-change live readback and independent acceptance recorded | Blocked / independent | Owner evidence pending |

**Immediate next blocker:** independent database/security owner review of live exposure and other audit producers, then controlled rollback/hosted UAT. Parallel GitHub dependencies: protect main, independently approve PR #15 and configure protected lab-only secrets. Never apply the review SQL on its own.

**Audit packet conditional remaining batches:** 2–5 milestone-closing batches **after** independent owner and hosted access prerequisites. With those absent, no finite build countdown can be defended.

## Cross-program release blockers

- GitHub main protection: missing; independent PR #15 reviews: 0
- Isolated hosted Auth: 0/9; fictional fixtures: 0/38; accepted hosted UAT: 0/140
- Production security remediations accepted: 0/48; release signoffs: 0/9
- Production audit rights unsafe; source-only PRs #16, #18 and full CRM #12 are unmerged
- No production/staging permission writes, live email, finance activation, or main merge authorized by passing draft CI

**Whole-project illustrative build arithmetic:** 31 open milestones / 3, 2, or 1 independently accepted milestones per batch gives approximately **11 / 16 / 31 milestone-closing batches**. This is not a promise or a delivery date; if no acceptance gates close, more builds do not make official progress.

## Build reporting rule

Every future build report must show: A accepted score and change; B–H category split; active workstream/milestone and substeps; specific new engineering evidence; owner blockers; conditional estimates. Validate via `node security/release-progress/workstream-report.mjs --check`.
