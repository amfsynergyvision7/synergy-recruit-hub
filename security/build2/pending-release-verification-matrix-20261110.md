# Security Build 2 — remaining release verification matrix (2026-11-10)

Status: REVIEW ONLY. This is a test and decision plan, not authorization to merge, deploy, access business records, or change finance rules. PR #11 remains subject to nine release gates.

## P0: Bulk mutation unknown-commit outcome
- A network timeout after database commit is **unknown**, not failed. Do not automatically retry retained IDs.
- Before retry, refresh authoritative rows and compare each target's actual field values or deletion state. For non-idempotent actions and trigger side effects, escalate to manual reconciliation.
- Test cases: (1) rejection before server write, (2) commit then lost response, (3) partial ID response, (4) RLS zero-row update, (5) failure in batch 2 after batch 1 committed, (6) selection changed during pending request.
- Acceptance: no false success; confirmed vs unknown vs not-applied outcomes differentiated; no blind replay; operator sees per-batch counts.

## P0: Staging migration and recovery rehearsal
- Use disposable/staging database with a schema equivalent to production, no live candidate rows.
- Record schema and trigger/function/policy/grant inventory and baseline; apply migration in a transaction where feasible; run authorization and application smoke tests; rehearse rollback and compare inventory.
- Acceptance: expected objects and permissions match, forbidden access denied, authorized CRUD works, stage-trigger side effects tested, rollback restores baseline. Retain logs and checksums.

## P0: Role-based browser tests
- Test admin, active assigned recruiter, other recruiter, inactive user and unauthenticated user for candidate create/read/update/delete, stage drag-and-drop, assignment, bulk operations and workflow rules.
- Acceptance: denied operations show errors without success notifications; no cross-recruiter exposure; valid operations work; refresh reconciles UI with server.

## P0: Management policy decisions — do not infer
- Recruiter assignment/reassignment authority, including manager and automation exceptions.
- Workflow allowlist reconciliation for offers.joining_status, billing.payment_status and clients.status; require field-by-field permission and audit requirements.
- Financial stage-trigger fee and GST formulas, error handling and billing side effects require separate business/tax signoff; no reliance on existing hard-coded amounts as approved policy.

## P1: Privileged-function review
- Qualify object references and fix search_path for SECURITY DEFINER functions after dependency review.
- Test duplicate candidate-default triggers and stage-history no-op behavior against complete schema before considering removal.

## Release decision
All nine release evidence conditions remain blocked until independently verified. No merge or deployment without explicit management authorization after evidence review. This checklist alone closes no release gate.
