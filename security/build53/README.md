# Build 53 — Atomic Candidate CSV/Excel Import (REVIEW / RELEASE HOLD)

## Implemented in the draft branch
- `crm_import_candidates_atomic(request_id, assigned_recruiter, rows)`: admin-only, 1–50 create-only candidate rows within ONE PostgreSQL transaction. No partial success. Calls Build52 audited `crm_write_candidate` for each candidate; it cannot change a pipeline stage, update existing candidates, delete duplicates, bill clients or send external messages.
- A private `crm_private.candidate_import_batches` ledger binds `(actor_id,request_id)` to a SHA-256 of the JSON batch, approved recruiter, candidate IDs and count. Replaying the **same** request confirms the original candidate IDs without re-inserting. Replaying changed content or recruiter under the same ID is rejected. No PII duplicates are stored in the ledger.
- The RPC checks approved active administrator + approved active assignee, blocks active candidate workflow rules, locks the candidate table to serialize duplicate scans, and rejects duplicate normalized emails/phones both within the uploaded file and across existing candidates. Row limit, payload size and allowlisted ordinary fields are enforced server-side.
- The browser import page's future candidate-only path calls the typed RPC, uses a persistent request ID for unknown outcomes, enforces one batch with no skipped/updated rows, supports approved recruiter selection, and blocks stage changes. The **unconditional Build50 bulk import hold remains ON**. Other modules remain preview-only/paused.
- Build52's malformed full-policy SQL composer (a previously queued CI script) was corrected before this addition and is checked by a new Node source-contract test.
- CI and disposable PostgreSQL checks cover successful two-row commit, exact idempotent replay, changed-payload conflict, duplicate rejection, invalid second-row all-or-nothing rollback, audit-failure rollback, workflow-rule refusal, unauthenticated/pending/recruiter denial, grant/ledger isolation and the baseline 67→35 RLS integration.
- The candidate retention/deletion/merge policy, 140 hosted real-user authorization cases, joined-stage billing financial approval, independent reviews, branch protection, backups and nine gates remain outstanding. No production writes, merge or deploy.

## Release limits
These are **review-only** designs and synthetic acceptance evidence. Test passes cannot authorize production rollout or automatically enable browser imports. Only management-approved migration, hosted GoTrue role UAT, independent review and rollback plan may release the hold.
