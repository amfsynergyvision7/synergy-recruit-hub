# Build 122 — Two-stage synthetic growth/CRM review and audited no-send handoff

## Engineering deliverables

- Executable offline CLI `security/lead-discovery/review.mjs`, building on source/date-traceable synthetic JSON-LD businesses from Build121
- Exact company-domain deduplication, contradictory metadata rejection and strict allowlisted fields; no personal names, emails, phone numbers, recruitment/hiring claims or fabricated commercial terms
- Explicit research-owner separation, growth-reviewer then distinct CRM-reviewer approval, signed-date-shaped evidence citations, final rejections and a pending-review default
- Hash-chained in-memory review/reject/handoff audit events (tamper evident but **not an actual human cryptographic signature or persisted audit database**)
- Fictional `review-decisions.synthetic.json` exercising one two-stage approved offline preview, one rejection and one pending CRM review; no real people or businesses
- **19 automated regression tests** covering CLI, gating, duplicate merging, source provenance, private-data rejection, forged identities, second-review separation, audit integrity and zero network/CRM/outbound code paths

## Scoring boundary

Candidate rubric gate LD04: *Approval queue, privacy checks, duplicate handling and audited no-send CRM handoff pass tests.* This implementation is software acceptance on **synthetic examples**, with no authorized real contacts, actual independent human approver actions or live CRM handoff. Do not credit LD02 approved real-source whitelist, SO04 operational sending, CRM10 workflow signoff or any REL production gate. Only award LD04's two rubric points if the exact-head CI verifies the functional controls and the owner accepts this strictly test-only interpretation of the gate.

## Runbook

`node security/lead-discovery/review.mjs queue security/lead-discovery/manifest.synthetic.json`

`node security/lead-discovery/review.mjs handoff security/lead-discovery/manifest.synthetic.json security/lead-discovery/review-decisions.synthetic.json`

`node --test security/build122/lead-review-and-handoff.test.mjs`

All outputs go to stdout only. No files are written, no HTTP requests or email are sent, and no CRM action is possible from this script.

