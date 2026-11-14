# AMF Synergy Vision — immutable deployment-completion rubric v1

**Baseline: Build 120, 14 November 2026.** This is the fixed full-program scorecard requested by the owner. It covers the six official workstreams plus mandatory shared release controls. It is *not* a retrospective redefinition of the old 25% provisional management estimate.

**Observed current completion = 22/100 points (22%), 78/100 remain.** A retrospectively comparable Build119 v1 baseline is also 22/100; **Build120's newly CLOSED release milestones = 0; score delta = +0**. Workstream acceptance remains **0/6 formally closed**.

## Non-negotiable scoring rules

1. All 43 milestone IDs and their fixed weights sum to 100. Freeze `v1-rubric.json`. Never silently change weights, scope or acceptance criteria. Any revised scope requires owner-approved v2 and an explicit v1-to-v2 comparison table.
2. Each milestone earns either **all** of its points after its specific acceptance evidence exists or **zero**. Draft code, estimates, tests for a different milestone and PR comments are not substitutes for hosted UAT or independent signed release approval.
3. `build119-retrospective-baseline.json` stays immutable. Each new build updates `current.json` only with observed state, linkable evidence and checked date. Record previous and new score and the *specific milestone IDs* that changed. A regression can reduce the score; do not hide it.
4. The 22% is a rubric-defined **weighted evidence completion**, not a time estimate, risk reduction percentage or permission to deploy. It is not comparable to the historical 25% subjective pre-security workstream judgment.
5. The deliberately red `production-release-hold` is never scored as passed CI. Only substantive guarded jobs may count toward the draft engineering check. The production launch gate requires an independent successful authorized release.
6. No user blanket approval can impersonate GitHub branch administration, a nonauthor PR reviewer, protected environment reviewer, GoTrue credential custodian, legal/finance approvers or formal signatories.

## Workstream score at baseline

| ID | Workstream | Earned | Fixed max | Milestones passed |
|---|---|---:|---:|---:|
| KB | Company knowledge base & team assistant | 6 | 12 | 3/6 |
| LD | AI lead discovery & research | 2 | 10 | 1/5 |
| MK | Marketing, branding & creative | 2 | 10 | 1/5 |
| SO | Sales outreach & follow-up | 2 | 10 | 1/5 |
| CRM | CRM, recruitment & AI automation | 10 | 28 | 4/10 |
| BI | Business intelligence & dashboards | 0 | 10 | 0/5 |
| REL | Cross-program release & governance | 0 | 20 | 0/7 |
| **TOTAL** | **Full six-workstream programme** | **22** | **100** | **10/43** |

## Fixed detailed milestone ledger — full breakup

| Gate | Milestone | Points | Earned | Owner | Acceptance requirement | Evidence or blocker |
|---|---|---:|---:|---|---|---|
| KB01 | Six approved minimum knowledge excerpts | 2 | 2 | CEO / knowledge owner | Individually approved K01–K06 excerpts evidenced; not blanket approval of full source documents. | [proof 1](https://docs.google.com/document/d/15qZiquZb4c9AEcoI-MftLHiDfZNoW-ibrt78XWf5EKc/edit) |
| KB02 | Private knowledge assistant packaged | 2 | 2 | Knowledge owner | Private CEO-only plugin demonstrably exists, without CRM or outward action connectors. | [proof 1](https://docs.google.com/document/d/15qZiquZb4c9AEcoI-MftLHiDfZNoW-ibrt78XWf5EKc/edit) |
| KB03 | Knowledge offline + prompt tests | 2 | 2 | Knowledge QA | At least 14/14 offline and 10/10 supervised prompt checks evidenced (not pilot closure). | [proof 1](https://docs.google.com/document/d/1Q4pck9U4Mr-T8Nv1TS0Yo_ItbbDYM3YwRTDzb8jOkuE/edit) |
| KB04 | Five-business-day pilot formally closed | 2 | 0 | CEO / pilot owner | Observation dates, issues, incident register and signed CEO pilot closeout accepted. | Not independently accepted |
| KB05 | Company facts and SOP version control | 2 | 0 | Knowledge / policy owner | Authoritative company facts and current SOP versions separately signed, cited and expiry-managed. | Not independently accepted |
| KB06 | Approved employee team-assistant rollout | 2 | 0 | CEO / access owner | Access model, staff safety acceptance, deployment and accountable owner signoff completed. | Not independently accepted |
| LD01 | Lead-research governance draft | 2 | 2 | Growth owner | Public-business-data lead research and outreach guardrails exist as an owner-controlled review draft only. | [proof 1](https://docs.google.com/document/d/1Q4pck9U4Mr-T8Nv1TS0Yo_ItbbDYM3YwRTDzb8jOkuE/edit) |
| LD02 | Lead ICP and source whitelist approved | 2 | 0 | Growth / compliance | Industries, target personas, exclusions, permissible sources and proof/retention policy signed. | Not independently accepted |
| LD03 | Traceable lead discovery implementation | 2 | 0 | Lead engineering | Runnable low-cost discovery with source URL/date and deduplication demonstrated on approved synthetic/business-only cases. | Not independently accepted |
| LD04 | Human lead review and CRM handoff | 2 | 0 | Growth / CRM owner | Approval queue, privacy checks, duplicate handling and audited no-send CRM handoff pass tests. | Not independently accepted |
| LD05 | Lead discovery KPIs accepted | 2 | 0 | Growth / BI owner | Qualified-source quality, freshness, yield and conversion KPIs verified with owner acceptance. | Not independently accepted |
| MK01 | Marketing asset inventory recorded | 2 | 2 | Marketing owner | Existing draft assets and review inventory traceably documented; not public claim approval. | [proof 1](https://docs.google.com/document/d/1Q4pck9U4Mr-T8Nv1TS0Yo_ItbbDYM3YwRTDzb8jOkuE/edit) |
| MK02 | Brand language and claims approved | 2 | 0 | Marketing / CEO | Approved brand system and fact-checked evidence-based public claims signed by brand owner. | Not independently accepted |
| MK03 | Creative production workflow tested | 2 | 0 | Creative lead | Approved templates, repeatable review/edit pipeline and human approval checkpoints pass tests. | Not independently accepted |
| MK04 | Publishing process accepted | 2 | 0 | Marketing / compliance | Channel rights, review, consent, scheduling and rollback tested; no unsupervised publication. | Not independently accepted |
| MK05 | Campaign reporting and signoff | 2 | 0 | Marketing / BI owner | UTM/source attribution, measurement evidence and owner acceptance signed. | Not independently accepted |
| SO01 | Sales outreach drafts documented | 2 | 2 | Sales owner | Existing B2B communications and human-review draft templates documented only. | [proof 1](https://docs.google.com/document/d/1Q4pck9U4Mr-T8Nv1TS0Yo_ItbbDYM3YwRTDzb8jOkuE/edit) |
| SO02 | Outreach data and permission policy | 2 | 0 | Sales / legal | Sender identity, lawful business contacts, opt-out/suppression, safe cadence and contact review approved. | Not independently accepted |
| SO03 | Approved versioned communication templates | 2 | 0 | Sales / legal | Fact-checked signatures, messaging and legal clauses separately signed; inactive drafts excluded. | Not independently accepted |
| SO04 | Controlled outbound pilot accepted | 2 | 0 | Sales / security | Human-authorized send workflow with correspondence logs, opt-outs and no mass-send leaks tested and signed. | Not independently accepted |
| SO05 | Sales response KPIs and owner acceptance | 2 | 0 | Sales / BI owner | Reply, meeting, referral, suppression and conversion reports verified; owner closes workstream. | Not independently accepted |
| CRM01 | Draft CRM fast security contracts pass | 3 | 3 | CRM engineering | Exact latest PR #12 head has completed zero-secret fast contract CI with no test failures. | [proof 1](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43555301488) · [proof 2](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12) |
| CRM02 | Draft CRM build/typecheck & guarded tests pass | 3 | 3 | CRM engineering | Exact latest PR #12 head compiles, typechecks, and passes nonrelease guarded jobs; deliberate hold remains red. | [proof 1](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43555301454) · [proof 2](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12) |
| CRM03 | Narrow synthetic Auth runner tested | 2 | 2 | CRM / Auth engineering | Exact PR #15 head passes all 40 offline contracts and Vite client/SSR builds; no privileged run. | [proof 1](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43502912428) · [proof 2](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) |
| CRM04 | Isolated nonprod structural preflight passes | 2 | 2 | DB / security | Read-only lab has 19/19 RLS tables, 13/13 invoker-safe views, 32/32 disabled app triggers, zero real users/data. | [proof 1](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13) · [proof 2](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15) |
| CRM05 | Full CRM PR independently reviewed | 3 | 0 | Independent CRM reviewer | PR #12 approved by eligible independent reviewer, complete code audit and protected merge accepted. | Not independently accepted |
| CRM06 | Nine nonprod Auth identities provisioned | 2 | 0 | Nonprod Auth operator | GoTrue Admin creates exactly 9 synthetic example.invalid accounts in independently protected lab. | [hosted-UAT issue](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13) |
| CRM07 | 38 inert hosted fixture rows accepted | 2 | 0 | Nonprod DB owner | Exactly 38 source-shaped synthetic records with 8 profiles/8 roles and ninth unprofiled account verified. | [hosted-UAT issue](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13) |
| CRM08 | 140 signed hosted acceptance cases | 4 | 0 | UAT / security signatories | 135 signed-read plus 5 controlled signed-write cases executed and independently accepted, not CI mocks. | [hosted-UAT issue](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13) |
| CRM09 | 48 production remediations accepted | 4 | 0 | Production security/DB | 19 table privileges, 13 views and 16 privileged functions remediated, regression-tested and independently signed. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| CRM10 | CRM workflows formally accepted | 3 | 0 | Recruitment / CRM owner | Recruiting records, ownership, audit, PII protections, sync and finance holds end-to-end signed for permitted scope. | Not independently accepted |
| BI01 | Official metric dictionary approved | 2 | 0 | BI / CEO | CEO/ops approve KPI definitions, sources, access and exclusion policy. | Not independently accepted |
| BI02 | Role-safe reporting data contract | 2 | 0 | BI / security | No sensitive data leaks; audited RLS-safe aggregate model and column-level scope accepted. | Not independently accepted |
| BI03 | Working role-appropriate dashboards | 2 | 0 | BI engineering | Management and recruiter dashboards implemented and test against authorized source data. | Not independently accepted |
| BI04 | Reconciliation and freshness monitored | 2 | 0 | BI / operations | Quality, completeness and timeliness controls measured with documented threshold alerts. | Not independently accepted |
| BI05 | BI operating acceptance signed | 2 | 0 | BI / CEO | BI KPI reconciliation and usability signed by business owner. | Not independently accepted |
| REL01 | Protected main with mandatory controls | 3 | 0 | GitHub repository admin | main is protected with required PR approvals/checks, no force pushes and restricted bypass; readback verified. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL02 | Independent PR15 approval + protected merge | 3 | 0 | Independent reviewer / admin | Exact frozen PR #15 independently approved by eligible nonauthor reviewer and merged under protection. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL03 | Protected nonprod environment and lab secrets | 2 | 0 | Security administrator | Reviewed amf-nonprod-auth-review environment, distinct approver and lab-only scoped secrets independently attested. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL04 | Backup/PITR and restore drill signed | 3 | 0 | DB / operations | Production-equivalent encrypted backup, PITR availability, measured RPO/RTO and restore test signed. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL05 | Legal, finance, HR and privacy clearance | 3 | 0 | Legal / finance / HR | Required HR, legal, finance, privacy/security signoffs for approved scope; D-003 remains inactive until reviewed. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL06 | All nine formal release gates signed | 3 | 0 | Release board | Nine identifiable independent release gate signatories accepted with dated evidence and no AI self-approval. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |
| REL07 | Authorized production deployment & smoke test | 3 | 0 | Release owner | Approved production deployment, smoke verification, monitoring and rollback readiness confirmed by owner. | [release blocker](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14) |

## Critical external dependencies

- Protected `main`, reviewer rules, environment controls: [Issue #14](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14). **Not currently configured**.
- Narrow PR #15 head `9db170d4e131a513d5216e571d3f7a7af85d65f3`: [review candidate](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/15); 0 independent reviews, not merged. Do not change its head without reviewer need.
- Draft PR #12 head `4029521d33e9bb6778e435b3e819af8980421a49`: [engineering branch](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12); future progress-doc commits on PR #12 are not a protected merge.
- Hosted synthetic nonprod: 19/19 RLS public tables, 13/13 invoker-safe views, 32/32 disabled public app triggers, 0/9 Auth, 0/38 fixtures; [Issue #13](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13).
- Signed hosted acceptance: 0/140, production remediation signoff 0/48, release board 0/9, accepted full workstreams 0/6 **as recorded**. These are separate formal denominators.
- Full-program historical planning analysis and approved source material: [owner-controlled master tracker](https://docs.google.com/document/d/15qZiquZb4c9AEcoI-MftLHiDfZNoW-ibrt78XWf5EKc/edit) and [evidence register](https://docs.google.com/document/d/1Q4pck9U4Mr-T8Nv1TS0Yo_ItbbDYM3YwRTDzb8jOkuE/edit).

## Running the scorecard

`node security/release-progress/score.mjs` prints the 100-point total, baseline delta and all seven fixed area rows. `node --test security/build120/release-progress-contract.test.mjs` prevents false evidence-less completions, denominator drift, silent exclusion of open protected gates and invented progress.

## Approximate outstanding effort, not a countdown

33/43 fixed milestones are still unmet, equivalent to 78 fixed points. Because an external administrator/reviewer and acceptance owners have not yet supplied mandatory checks, there is **no defensible finite build count**. A scenario of 12–25 *gate-closing delivery batches* after those prerequisites is an illustrative planning range only; it is not a forecast and must never be rolled forward without a gate-by-gate burn-down.

**Build120 actual milestone movement: 0 points; deliverable: the frozen measurement/control system.**
