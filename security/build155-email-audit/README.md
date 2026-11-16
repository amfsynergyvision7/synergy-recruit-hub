# Build155 — CRM email delivery/audit integrity, source-only review

**DRAFT ONLY / DO NOT MERGE / DO NOT SEND EMAIL / DO NOT APPLY SQL / NO PRODUCTION DEPLOY.**

This is a narrow dependent PR targeting draft full CRM PR #12 at exact parent `b2734b14c0e19d2ce2b8daa87655ca18c2d932d6`, not `main`. It responds to [release issue #17](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/17). All old outbound-communications release holds remain in place.

## Code mitigation and test contract

- A **separate immutable server-side email audit integrity hold** defaults to `true` and executes immediately after the existing outbound hold, before even recipient queries. No environment variable or UI switch can release it.
- The proposed code path reserves and confirms one actor-bound `email_log` row in `pending` status **before any SMTP call**. Unconfirmed insert/readback prevents sending. Only the exact pending ID, sender and final status can be settled; a failed update never returns success. Provider errors and uncertain outcomes are marked `unknown`, not definitively failed, and require manual reconciliation. SMTP errors/addresses/bodies are not echoed into application diagnostics.
- The no-secret test suite verifies release holds, exact journal reservation and settlement, source call ordering, no direct service-role bypass, unknown provider outcomes and source-only SQL preflight. Existing recipient ownership and credential holds are not weakened.
- The metadata-only `email-log-preflight.readonly.sql` queries only PostgreSQL policies, column names and trigger metadata; does not query message content.

## Why this is NOT ready to send

Live production metadata-only evidence on 15 November 2026: `email_log` has 11 expected columns, one `authenticated` INSERT policy, an authenticated SELECT policy and **NO authenticated UPDATE policy**. The proposed 67-to-35 replacement would also remove direct authenticated INSERT. Consequently, the two-stage source code **cannot be activated as a complete working feature**. Qualified CRM/security/communications owners must independently review and implement a narrow trusted RPC or transactional outbox, exact record/actor authorization, constrained transition privileges, idempotency across retries, a durable send-attempt correlation and a safe unknown-outcome reconciliation process.

An SMTP provider may accept a message immediately before a process interruption, leaving `pending`. Even after a failure, delivery may be uncertain. **Do not retry automatically**, interpret pending as proof of non-delivery, expose service-role keys to browser code or grant broad public INSERT/UPDATE privileges. Require nonproduction provider-disabled/sandbox UAT and signoff before any real outreach.

This is an engineering safety improvement and review artifact only; **0/140 signed hosted tests, 0/48 approved production permissions, 0/9 release signoffs, no acceptance improvement**. Issue #17 remains open.

## Build156 — executable provider-disabled protocol harness

The Build155 journal flow has now been extracted into **`executeCrmEmailAuditProtocol`**, an actual function used by the server handler. Its reserve/provider/settlement callbacks are injected so CI can execute the **same control flow** with fake in-memory effects, without Supabase credentials, mail providers or network access. Tests prove provider delivery is invoked exactly once and only after exact reservation confirmation, and that unknown outcomes, missing provider correlation IDs, exceptions, settlement errors and mismatched rows never return success. There are no automatic retries. `crmEmailOutcomeStatus` now treats provider success without a valid bounded printable message ID as **unknown**, requiring reconciliation.

The production schema is *still* missing an authenticated `email_log` UPDATE policy and the proposed future RLS removes direct INSERT. The fully independent second hard audit hold remains true and the outbound SMTP hold is also true. No code from this draft can activate real delivery. A reviewed narrow database outbox/RPC, durable idempotency, provider retry strategy, verified least-privilege role tests and issue #17 closure are still mandatory. This executable offline harness is **not signed hosted UAT or release approval**.

## Build157 — stable cross-request idempotency boundary using the existing UUID primary key

The live production catalog verified that `public.email_log` has the actual `email_log_pkey PRIMARY KEY (id)`, so a *narrow, schema-free* draft mitigation is possible. The CRM composer now generates one `crypto.randomUUID()` per opened compose session and retains it across repeated mutation calls, including failed/unknown outcomes. The authenticated server endpoint requires a canonical UUIDv4 `requestId` and uses it **directly** as the journal `id`, rather than generating a different ID for each server call. An ordinary PostgreSQL `INSERT` under the existing unique primary key fails atomically for duplicate attempts, **before** the provider callback; no upsert, conflict-ignore or read-then-send path is allowed. Concurrent same-ID fake requests and a retry after failed settlement now prove **at most one provider invocation**. The source-pinned read-only SQL preflight also checks the primary-key constraint itself.

**Limits and safeguards:** This reduces duplicate SMTP attempts **only for calls reusing the same request UUID**. New IDs from a different browser session, new compose actions or direct API clients can still represent distinct messages even with identical body, actor and recipient; it is not a complete business-level deduplication or exactly-once email guarantee. It does not prevent provider duplication internally. The authenticated UPDATE policy is still absent, and the proposed 67→35 RLS removes direct INSERT. **The immutable email audit hold and the original outbound hold remain true**. Reviewers must still approve a narrowly authorized outbox/RPC, full actor/payload fingerprint or conflict semantics, permission model, sender-state transitions, manual reconciliation and signed hosted sandbox UAT before sending is enabled. This is code/test preparation, not issue #17 closure or production approval.
