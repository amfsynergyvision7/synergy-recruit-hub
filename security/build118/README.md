# Build 118 — inactive legal terms and browser correspondence release interlock

## Implemented technical fixes

- Removed an automatic candidate selection/placement-terms template whose embedded fee, salary timing, tenure and acknowledgement claims must not be communicated before management/legal review. Replaced it with an optional neutral, noncommittal draft-only follow-up. This does not revise or activate D-003.
- Added `CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED = true as const` and `assertCrmEmailSendAllowed` in `src/lib/release-safety.ts`. The browser send button is disabled, plus the mutation checks the client hold synchronously before any server RPC. The independent `assertExternalEffectReleased("crm_email")` server hold remains active before provider/network/log writes.
- The composer now describes its real held state; external send errors are not displayed verbatim.
- Existing email-merge and correspondence-history query keys now include signed-in Auth subject plus exact table+record ID, avoiding cross-user React Query cache collisions. Queries are not executed while the release hold applies.
- Generic row Mail actions are relabeled 'Draft email (sending paused)', and detail-view button says 'Draft email'.
- Six direct Build118 tests verify both holds, absence of fee/contract templates, no browser send, subject-specific query caches, absence of environmental bypass, safe errors and draft-only controls. The fast CI workflow actually executes them; both workflows trigger on Build118 and changed source files.

## Release limitations

PR #12 remains draft/unmerged and PR #15 stays unchanged for independent review. This is client-side defense-in-depth; server RLS, role/record constraints, external-effect hold, independently approved communications and legal-policy approval remain mandatory. No external messages, financial flows, CRM writes, database migrations, staging or production deployments are authorized by this build.
