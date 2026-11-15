# Build 121 — Executable offline synthetic business lead discovery

**Purpose:** meet fixed scorecard LD03's runnable low-cost discovery requirement on *synthetic/business-only input* without live scraping, prospect collection, CRM writes or outbound contact. This is not approval of a real-source whitelist (LD02), review/handoff (LD04) or sales outreach.

### What it does

- Consumes a source manifest of two explicitly fabricated `*.example.invalid` business directory HTML snapshots (committed reproducible fixtures). Never requests any network resource.
- Extracts organizational records only from static JSON-LD `Organization`, `LocalBusiness` and `Corporation` nodes. Intentionally ignores `Person`, `JobPosting`, emails, phone numbers, private contacts, vacancy/placement and fee claims.
- Requires bounded, syntactically valid HTTPS synthetic source/company URLs, date-stamped evidence, verified company name, business web domain, city and explicit industry in the archived source.
- Deduplicates the same company's website across independent snapshots and preserves source URL, snapshot capture date and evidence type for human review. No AI guesses, no enriched personal profiles, no lead messages or hiring assertions.
- Writes a JSON report to stdout only. All rows are marked synthetic, human review required, sending not authorized, CRM writes not authorized.
- Limits sources, script count, parsed entities and snapshot bytes; refuses traversal and symlinks that escape the manifest base directory.

### Exact reproducible command

`node security/lead-discovery/discover.mjs security/lead-discovery/manifest.synthetic.json`

Expected observation: **2 fictional source snapshots**, **4 extracted fictional company records**, **1 duplicate merged**, **3 normalized business-only leads**, all with source URL/date, zero real contacts/sending/CRM activity.

Direct offline Node tests: `node --test security/build121/lead-discovery.test.mjs`.

### What remains open

LD02 — management-approved real-source whitelist and ICP; LD04 — human approval queue and CRM handoff; LD05 — production KPI baselines and signed acceptance. The present tool does not send requests, crawl websites or create live leads, and must not be represented as a production lead-generation service.

## CI contract

The GitHub fast CI workflow executes the full end-to-end synthetic discovery suite alongside the fixed deployment scorecard tests, and the guarded workflow also triggers on these paths. **LD03 is not counted until an actual exact-head CI run passes the recorded 3-business deduplication/provenance proof.**

## Build 122 synthetic human-review/handoff stage

The following *local test-only* commands require no credentials, network access, CRM or third-party service:

```sh
node security/lead-discovery/review.mjs queue security/lead-discovery/manifest.synthetic.json
node security/lead-discovery/review.mjs handoff security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json
node --test security/build122/lead-review-and-handoff.test.mjs
```

- In `queue` mode all three fictional company-only rows remain **pending review**. There is no automatic approval.
- In `handoff` mode, explicitly supplied **fictional** growth and CRM reviewer identities independently approve one synthetic record, a second fictional business is rejected and a third awaits CRM review. The example reviewer identities are only fixtures, **not real human signatures or accepted live leads**.
- Growth approval requires a cited archived synthetic source and date; only a distinct CRM reviewer can promote the lead to an **offline, no-send JSON handoff preview**. Rejections are final, duplicate/conflicting source facts fail closed, email/phone/person fields never enter handoff.
- Review decisions, rejections and preview creation are traced with deterministic SHA-256 hash-chained audit events. The chain is tamper-evident in the printed preview; its chain is **not an externally signed or persisted compliance ledger**.
- No live business sourcing/ICP whitelist approval (LD02), operational sales contact, CRM write, public database insert, email or outreach occurs. An actual growth/CRM owner must separately authorize live integration.


## Build165 — Category C consolidation: LD02 + LD05 (NO LIVE SOURCING)

**New current focus: Category C, AI Lead Discovery (6/10 accepted, 3/5 official milestones).** All cross-category engineering is paused except independent critical security monitoring. This package does not request network access, scrape real sources, extract personal contacts, send messages or write CRM.

Two owner-review packets have been added: `LD02-ICP-SOURCE-APPROVAL.md` plus `lead-policy.review.json` (still no approved ICP/whitelist/retention), and `LD05-KPI-ACCEPTANCE.md` plus `kpi-acceptance.review.json` (still no approved KPI thresholds or real source sample). Source constraints are grounded in the connected CEO-only pilot draft documents, **not treated as approved operating policy**.

A real runnable, offline-only synthetic metrics program now computes aggregate provenance, evidence freshness, deduplication, review completion and no-send handoff preview yield with safe denominators. No operational conversion metrics are invented. Run `node security/lead-discovery/metrics.mjs security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json 2026-11-15`.

`category-c-v1.json` tracks official LD01–05 status and two remaining gated subpackages. This is an engineering evidence packet; official score increases to 8/10 or 10/10 **only with individually supported owner acceptance and valid verification**. Critical production audit Issue #19 remains HOLD; unrelated draft security changes are not included here.

**Current category dashboard:** [Category C milestone / substep tracker](./CATEGORY-C-STATUS.md), CI-reconciled against the frozen 100-point scorecard. The two remaining LD acceptance gates are explicitly open.

## Build166 — LD02/LD05 technical hardening (same Category C focus)

The offline KPI engine now checks source-derived business identities, every reviewer decision's source and audit event, the exact no-send handoff identity, and denies mismatched counters and fabricated approvals. `approval-preflight.mjs` reports exact missing LD02/LD05 policy, evidence, threshold and owner fields. **This is a negative-readiness diagnostic, not an approval engine.** No new independent gate closes merely because these tests pass.

```sh
node security/lead-discovery/approval-preflight.mjs
node --test security/build166-lead-category/contract.test.mjs
```

Category C remains 6/10 officially accepted and the review packet 4/8 owner-gated steps source-evidenced; no real lead lookup, contact or CRM access is activated.

## Build167 — separately curated synthetic KPI reference and owner closure packet

A separately hand-authored (but not human-signed) `curated-reference.synthetic.json` is cross-reconciled by `reconcile.mjs` with the exact fictional discovery/review ledger. All 30 expected source, business identity, status and metric checks must agree. Failure is explicit and CI-tested. The category status generator now uses the correct frozen rubric field `title` instead of displaying `undefined`; it keeps the 43-gate weighted score unchanged. See [Owner-ready LD02+LD05 closure instructions](./LD02-LD05-OWNER-CLOSURE.md). No real samples or approvals exist.
