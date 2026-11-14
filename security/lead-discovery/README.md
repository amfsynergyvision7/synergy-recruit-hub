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
