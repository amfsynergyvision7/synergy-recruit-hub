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

## Build168 — owner acceptance evidence intake without false signoff

The draft-only, zero-network `acceptance-handoff.mjs` checks the **specific LD02 and LD05 owner submission shapes** and identifies outstanding independent-source and consent requirements. It rejects malformed or secret-bearing links, mismatched scope fingerprints, duplicate signoff refs, contradictory aggregate business sample counts and any contact/CRM effects. This is a **negative/structural preflight**, not a signature authority or production activation.

Run `node security/lead-discovery/acceptance-handoff.mjs`; the default deliberately reports both milestones not independently accepted. Only company-level aggregate sample counts can enter `ld05-independent-sample.review.json`; detailed person data and actual company/contact records are prohibited. `ld02-independent-evidence.review.json` is unsubmitted, with no inferred market policy or signatures.

The LD02 real-source whitelist now accepts only canonical HTTPS **business origins** (domain only), rejects source paths, query tokens and private/reserved hosts. Specific domains, lawful terms, retention, independent Growth/Privacy and Growth/BI decisions are still missing. This is **acceptance handoff readiness, not acceptance**, and the official Category C score remains **6/10**. No further pre-approval code batches are planned without specific reported defects.

## Build171 — frozen scorecard moved into explicit local test fixtures (isolated main-target PR only)

To prevent a dated Build138 scorecard being mistaken for a fresh `security/release-progress/current.json` on main, the isolated PR now keeps unchanged historical JSON bytes under `fixtures/release-progress/` and asserts their SHA-1 Git blob hashes. Existing Category C tests import these files as **offline evidence snapshots**, never current operational data. This package remains DRAFT / RELEASE HOLD. Its official acceptance is unchanged: Category C 6/10, overall 26/100 recorded as historical scorecard evidence; LD02 and LD05 remain owner-gated.

## Build172 — provenance URL metadata privacy fix

The offline parser now rejects **query strings (including a bare `?`), percent-encoded source path segments, contact-bearing `@` paths and malformed/punycode synthetic host labels**, while preserving the frozen fictional business sites and static directory paths. This is a conservative safeguard against accidentally echoing private tokens or identifiers from a user-supplied *synthetic fixture URL* into an offline review report. The underlying reserved-domain policy, no-network execution, no-send CRM handoff and independent owner acceptance holds are unchanged. This validation is not a claim that all sensitive information could be identified automatically.

Build172 carries an additional regression suite. PR #22 remains **Draft and unsafe to merge while `main` is unprotected**; PR #20 remains for independent code review on the integration base. Do not interpret CI passing or these new tests as LD02/LD05 owner approval.

## Build173 — privacy and conflicting-source deduplication repair

A concrete bug was found in the offline discovery source: company `name`, `industry` or `city` values that contained emails, contact-like phone numbers, mailto/tel schemes or template-markup could be returned by the **discovery CLI** even though the later review stage rejected personal contacts. These values are now **excluded before they can enter any discovery report**; this does not purport to identify all forms of personal information.

A second source-integrity gap permitted two snapshots with the **same fictional company domain but conflicting name, industry or location** to be silently treated as duplicates with the first snapshot winning. The parser now fails the **entire conflicting discovery input** for independent manual reconciliation, regardless of snapshot order. Exact, consistent duplicates still merge dated proof sources. New Build173 tests cover these cases and verify that the fixed fictitious baseline/KPI outputs remain unchanged.

Both the direct-to-`main` Draft PR #22 and integration PR #20 carry this common source-code fix; its CI passing never constitutes LD02/LD05 owner signatures or deployment authorization.

**Build173 canonical fictional fixture correction:** CI showed `directory-b.html` used “Acacia Logistics Test Duplicate” for the same fictional `acacia.example.invalid` domain whose other snapshot said “Acacia Logistics (Synthetic)”. Because strict conflicting-source validation correctly rejected that inconsistency, the *fictional second-source name* was normalized to the original, already-accepted fictitious company name. Source URL, dates, business count, deduplicated population, audit decisions and hand-curated KPI reference remain unchanged. This is a **fixture correction, not evidence of a real company or a human signoff**; retain the strict conflict rejection for actual inconsistent inputs.


## Build174 — deterministic website identity and bounded structured-data evidence

The source-only synthetic discovery parser now **emits the same canonical (non-www) company origin it uses for duplicate identity**, whether the first fictional source had a \`www.\` prefix or not. Previously a \`www.\`-first source could produce a review/KPI mismatch despite otherwise identical business evidence. New tests verify source-order invariance and a complete offline audit/KPI flow.

JSON-LD parsing now requires an **actual script tag and a real type=application/ld+json attribute**, not lookalike data-type/prototype/x:type or a script-data element. Traversal is limited to 2,500 visited nodes per synthetic HTML source and avoids unbounded \`Array.push(...items)\` expansion. Valid preexisting test fixtures, business deduplication, six offline engineering controls and no-send behavior remain unchanged.

These are reliability and provenance-hardening changes only. LD02 and LD05 still need independently approved business-source policy and real authorized KPI evidence. Both review PRs remain unmerged and production release HOLD is untouched.
