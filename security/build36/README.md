# Build 36 — review-only candidate synchronization correctness

## Changes in this build
- Stop at the first failed source row instead of advancing the integration cursor beyond it.
- Track only contiguous successfully completed or intentionally blank rows, including full-history resets.
- Reject ambiguous candidate mobile/email queries (two or more candidate rows), rather than choosing newest.
- Reject a mobile match and email match that point to distinct candidate records, rather than merging one silently.
- Escape SQL ILIKE wildcard characters in an imported email before matching.
- Require explicit integration owner for getSavedGoogleIntegration and runCandidateSync.
- Keep the scheduler inactive by default. This patch is on a DRAFT PR only.

## Verification and remaining release blockers
- The sync importer still performs multiple privileged operations per row without a database transaction.
- Concurrent synchronization on Vercel serverless workers is not prevented by these changes; unique email/mobile indexes are not present in live production metadata. A reviewed database-enforced lease or supported uniqueness strategy is required before activation.
- A 500 on an already partial import does not reverse a candidate insert or update.
- Signed-user tests, App UI/browser compatibility, rollback, least-privilege database grants and independent review remain open.
- DO NOT MERGE, DEPLOY TO PRODUCTION, ACTIVATE SYNC, OR HANDLE REAL CANDIDATE RECORDS.
