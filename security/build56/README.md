# Build56 — Source-Derived Joined-Stage Finance Safety (REVIEW / HOLD)

Read-only production introspection on 2026-11-12 confirmed two enabled billing pathways:

- `trg_candidate_stage_change` executes `on_candidate_stage_change()`, which creates a candidate-only bill on `candidates.stage='joined'`.
- `offers_stage_billing_trigger` executes `on_offer_change()`. This first writes `candidates.stage='joined'`, which invokes the above candidate handler, then separately inserts an offer-linked bill if no offer-linked row exists.

The handlers contain **different deduplication criteria** (candidate UUID vs offer UUID), so a single offer join can produce two billing rows. The isolated integration reproduces this exact case from the live PostgreSQL function definitions. This is a source-level test, not a claim that actual production duplicate bills have occurred.

`financial-joined-transition-hold-review-only.sql` proposes an **unconditional BEFORE trigger** on candidate stage and offer status/joining transitions, blocking new `joined` state and joined reversals pending separate finance/legal approval. This is safer than blocking `billing` INSERT only because the live `on_candidate_stage_change` catches exceptions and can otherwise record an automation error while leaving the candidate at `joined`. The SQL blocks the cause before either AFTER trigger can invoice.

The new guard is one trigger function plus two trigger attachments. It does NOT replace statutory billing logic or approve any fee/tax rates, and it does not prevent a trusted database administrator from manually bypassing triggers. Review existing joined rows and downstream jobs independently before activation.

This fragment is **NOT deployed** to production or staging. The source-fingerprint query is SELECT-only; it must return `MATCH_SOURCE_ONLY_NOT_APPROVAL` to proceed with *further review*, never to authorize rollout. Synthetic PostgreSQL 17 tests prove original double-bill behavior and held transitions in one outer ROLLBACK. Formal hosted UAT remains 0/140.

## Build56 additional frontend safety: billing view-only

The draft review interface also holds **manual billing create/edit/delete and payment-status updates** behind unconditional `LEGACY_BILLING_MUTATIONS_PAUSED=true`, rendering the Billing screen view-only. The two joined-stage offer and candidate holds remain enabled. These browser flags are **presentation-only**; they are not production authorization and do not alter any live finance grants. A separately approved backend billing ACL and finance workflow decision is a mandatory release gate.
