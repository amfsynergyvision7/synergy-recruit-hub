# Build170: Category C, isolated direct-to-main review package

**REVIEW DRAFT — NO MERGE, NO LIVE SOURCING, NO DEPLOY.**

This branch is a **standalone copy of the existing source-only Category C test implementation**, made from the exact PR #20 blob contents at `f650f190b0bcc853518d01ba1ffe7d9b1e8cd0fc` and based on `main` at `c735292fbace6605d691a68b602a02b2c6f9e137`. It is not a cherry-pick of the CRM integration PR #12, and introduces no application runtime, database migrations, Auth, billing, outbound contact, finance automation, third-party SDK, CI secrets, or Vercel project configuration.

**Purpose:** remove an unnecessary code-review dependency on 882 unrelated draft CRM commits. Reviewers can now inspect the lead research and no-send handoff implementation on a main-targeted GitHub PR without reviewing hundreds of unrelated files.

**Boundary:** the two frozen `security/lead-discovery/fixtures/release-progress/` snapshot JSON files are carried as *historic review evidence only* to make Category C contract tests reproducible. `build138-current.snapshot.json` is **snapshot build 138 (14 Nov 2026)** and contains point-in-time observations, not an automatically refreshed source of truth or production endorsement. The acceptance accounting is still 26/100 overall and 6/10 Category C in the baseline. No accepted owner signatures are forged or inferred.

## Copy scope

- `security/lead-discovery/` — all 22 existing source, synthetics, markdown approvals, and read-only sample forms
- `security/build121`, `build122`, `build165-lead-category` through `build168-lead-category` — six existing standalone offline test files
- `security/lead-discovery/fixtures/release-progress/` — two historical, byte-for-byte snapshots required by tests (no top-level canonical `security/release-progress/current.json` is introduced)
- `.github/workflows/build165-category-c.yml` — synthetic-only PR test workflow, expanded with a deliberately failing `main-release-hold` job
- `security/build170-lead-category/main-isolation.test.mjs` — new boundaries/integrity tests for the main-targeted review cut

All other `main` files are inherited without modification. No external APIs, CRM, candidate records or real prospects are used.

## Verification and release

```bash
node --test security/build121/lead-discovery.test.mjs security/build122/lead-review-and-handoff.test.mjs security/build165-lead-category/contract.test.mjs security/build166-lead-category/contract.test.mjs security/build167-lead-category/contract.test.mjs security/build168-lead-category/contract.test.mjs security/build170-lead-category/main-isolation.test.mjs
node security/lead-discovery/category-status.mjs --check
node security/lead-discovery/acceptance-handoff.mjs
node security/lead-discovery/reconcile.mjs security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json
```

**Two separate releases gates still missing:** LD02 requires specific Growth+Privacy acceptance of ICP, lawful sources and retention; LD05 requires authorized actual organization-only source observations, signed operational KPI targets/denominators and Growth+BI acceptance. Even an approved engineering PR cannot establish these. Further, the independent security bootstrap PR #15, audit permissions issue #19, protected main, hosted UAT, and release signoffs keep production HOLD. The `main-release-hold` CI job is expected to fail until a separately authorized governance change after independently evidenced closure; neither this PR nor PR #20 should remove it automatically.

This is an **independent code review opportunity**, not a mandate or authority to merge.

## Build171 main-branch packaging risk repaired

The original isolation unintentionally staged the Build138 scorecard as `security/release-progress/current.json` at repository root. This looked like the current authoritative release register, despite being an **old frozen reference**. Build171 **relocated the two byte-identical historical snapshots into `security/lead-discovery/fixtures/release-progress/`** and updated the Category C test references. The original root paths were deleted from this unmerged draft branch, so an eventual cherry-pick would not create a misleading live release-progress location. A new test asserts exact Git blob hash parity, frozen dates and official score non-inflation. New data is not required.

The isolated branch continues to intentionally fail `main-release-hold` and must remain DRAFT until separately accepted source policy, security remediation, independent code review, protected main and release signoffs are evidenced.
