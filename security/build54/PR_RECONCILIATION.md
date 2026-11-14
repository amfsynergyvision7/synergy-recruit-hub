# Build54 — Draft PR #11 vs PR #12 Conflict Resolution Contract

**Status: REVIEW ONLY — NOT A MERGE APPROVAL**

Compared current GitHub PR changed-filename inventories (2026-11-12):
- PR #11, DRAFT, head `88926e510d4397fb48fe0c959ed80fdadc047362`: **145 files**.
- PR #12, DRAFT, head will vary with Build54: two same-path overlaps:
  `src/components/CrudModule.tsx` and
  `src/components/CandidateBoard.tsx`.

## Critical behavior-level conflict
The earlier PR #11 candidate Board still uses direct
`.update({stage: newStage})` against the candidate table; its CrudModule
uses browser table INSERT, UPDATE and DELETE for candidate mutations and
contains confirmation/result-reconciliation behavior.

Build54's PR #12 now:
- Permanently pauses candidate writes in presentation-level controls until
  actual server-side authorization and hosted acceptance are signed off.
- Replaces proposed candidate stage moves with the Build51 reviewed RPC.
- Replaces proposed ordinary create/detail edits with the Build52 reviewed RPC.
- Uses the Build53 atomic private-ledger import RPC with an unconditional hold.
- Keeps candidate delete, duplicate merge/delete and unreviewed billing disabled.

**Do not cherry-pick PR #11's direct browser writes into PR #12.** Confirmation
dialogs, optimistic update reconciliation and retry handling are worthwhile,
but those patterns must be reimplemented around typed server-reviewed RPCs,
never around direct candidate DML.

## Proposed merge sequence (not authorization)
1. Freeze both draft PR heads and obtain fresh exact-file diffs and live
   migration policy checks immediately before review.
2. Preserve all PR #12 server authorization, candidate write holds,
   audit/atomicity/financial risk gates as non-negotiable.
3. Reapply PR #11's non-security-breaking UX confirmations and safe
   concurrency responses only after fully audited RPC equivalents are verified.
4. Evaluate the *logical* differences between the two PRs' RLS and role
   policies even where file paths differ; the 2-file overlap is only the
   mechanical overlap, not proof of security compatibility.
5. Require a rebuilt combined CI suite, 140 genuine hosted Auth acceptance
   cases, independent review, branch protection, approved restoration/roll-
   forward and all nine formal release gates. Merge remains BLOCKED.

## Source-based regression contracts
`pr-reconciliation-contract.test.mjs` checks the Build54 branch still
retains the candidate pause, server-RPC future paths, stage/ATS immutability,
unapproved bulk import denial and non-destructive duplicate handling.
Those tests prevent accidental regression when earlier PR UX logic is later
reintroduced. They do NOT establish correctness of the separate PR #11 code.

## Remaining business ownership questions
The legal/operational owner must approve candidate deletion/retention,
cross-recruiter reassignment, stage transitions triggering finance, and
workflow-rule exceptions. This document does not establish a company policy.
