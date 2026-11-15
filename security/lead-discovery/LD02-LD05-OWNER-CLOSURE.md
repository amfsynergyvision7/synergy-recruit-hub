# Build167 — Category C LD02 owner decision and LD05 independent sample handoff

**No hidden approvals.** The final two fixed v1 lead milestones are LD02 and LD05 (2 official points each). They remain **OPEN**. This packet is specifically designed to enable **genuine owner closure**, not to add another indefinite technical sprint.

## LD02 decision owners (Growth + Privacy/Compliance)

Review [the inactive structured policy](./lead-policy.review.json), [source guardrails](./LD02-ICP-SOURCE-APPROVAL.md), and choose or reject the *hypothetical* market research segments. The required final choices are:
- Named target business sectors and geographies; only business **roles**, not personal identifiers
- HTTPS business-only source domains and explicit exclusions; source terms and lawful basis independently checked
- Public evidence date requirement, suppression/opt-out, a bounded retention period and no automatic messaging or CRM writes
- Separate dated Growth and Privacy/Compliance signoffs, externally verifiable against an approved record

A policy file filled with names is **not** a signature. The executable preflight prints missing fields and never enables live sourcing.

## LD05 decision owners (Growth + BI)

[The KPI review packet](./kpi-acceptance.review.json) requires agreement on the **six exact KPI definitions**, target thresholds, denominator and timezone. Once LD02 is properly accepted and authorized business-only source data are permitted, an actual independent sample must be checked by a qualified reviewer: source origin, dates, false positives, duplicates, excluded sources and independently calculated aggregate numerators/denominators. BI must record all discrepancies and acceptance thresholds. A separately dated Growth and BI acceptance record is required.

**Build167 offline illustration** — to show what this verification method looks like, without real leads:

```sh
node security/lead-discovery/reconcile.mjs security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json
node security/lead-discovery/approval-preflight.mjs
node security/lead-discovery/category-status.mjs --check
```

The manually curated reference `curated-reference.synthetic.json` contains three **fictional** organizations, four source proofs, separate expected review outcomes, two synthetic snapshot sources, one duplicate merge, and five exact synthetic KPI numerator/denominator pairs. `reconcile.mjs` independently compares a calculated result with these expected source values and reports mismatches. The reference is separately typed but **not signed by an independent human**. CI proves the code catches discrepancies; it cannot satisfy real-sample or Growth/BI approval requirements.

**Exit rule:** LD02 closes only with accepted specific ICP/source/provenance decisions and signoffs. LD05 closes only with authorized live organization-level evidence plus accepted operational KPI denominators and verified Growth/BI decisions. The independent reviewer must record acceptance in the fixed rubric; until then **Category C remains 6/10, programme 26/100, release HOLD**. No production email, scraping, CRM mutation, finance activation or database write is enabled.

**Forecast caution:** once such evidence exists, there may be **1–2 acceptance batches** remaining for Category C, but repeated engineering builds cannot replace external owner decisions.
