# Category C — LD02 ICP and public-source authorization packet

**Decision status: HOLD / REVIEW ONLY.** The [connected lead research guardrails](https://docs.google.com/document/d/1i5SVldFxYaSi2Ew1i4YJ0pUAxtGTXJ2AyKRGck8w6Gk/edit) are a CEO-only review draft, last modified 8 November 2026, **not** an approved live market or source whitelist.

To sign off LD02, the Growth and Privacy/Compliance owners need explicit selections in `lead-policy.review.json`: target industries and geographies, permitted buyer personas, the domain-level business-source whitelist, source terms and exclusions, lawful purpose, date-stamped source proof, evidence retention, opt-out/suppression and escalation rules. None may be inferred from existing customer or candidate data. Claims of current hiring, fees, achievements, guarantees or permission to contact require distinct evidence and approval.

**Existing safe source implementation:** `discover.mjs` strictly accepts local `.example.invalid` synthetic snapshots; it cannot fetch live sites even if someone edits a policy JSON file. Source collection, enrichment, CRM writes and sending remain disabled.

**Approval gate:** owner names, dated specific scope decisions and independently verified accessible documentation must be recorded; no model, maintainer or generic approval substitutes for actual authorized business/policy consent. File remains explicitly inactive until those gates exist.
