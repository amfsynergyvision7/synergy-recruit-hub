# Category C — LD05 source-quality and KPI acceptance packet

**Decision status: HOLD / REVIEW ONLY.** The [connected management KPI specification](https://docs.google.com/document/d/1FWA-0AtMrE4C6DAMQISnj6_1DBfICG7TIQkKUs6AO_o/edit) is a CEO-only design draft and focuses on general CRM dashboards rather than owner-approved lead-discovery thresholds.

`metrics.mjs` implements **aggregate-only synthetic evaluation** of the existing Build121/122 frozen discovery/review fixtures: public-source provenance, 30-day capture freshness, duplicate merge ratio, growth review completion and no-send handoff preview yield. It validates source URLs and date evidence, full review-status reconciliation, audit chain and zero network/CRM/send side effects. It intentionally reports real response and meeting conversion as **not available**, never 0%.

**To accept LD05**, Growth and BI owners must independently approve: the exact metric definitions, lawful source population and sample selection, freshness and quality thresholds, conversion denominator, time window (Asia/Kolkata), missing-data handling, reviewer responsibility and a real-source authorized sample matched to a manually checked evidence record. Document exclusions and privacy aggregation thresholds; do not pretend the fictional sample constitutes actual qualified lead yield.

`kpi-acceptance.review.json` is an unsigned decision packet (all targets and signatories null), not an approved SLA or operational benchmark.

Reproduce sample safely:
```sh
node security/lead-discovery/metrics.mjs security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json 2026-11-15
```
