# Build 35 — Focused review-only scheduler and role-gate fixes

RELEASE HOLD: do not merge, promote, schedule, or enable synchronization. The nine formal security gates remain incomplete.

## Proposed protected scheduled path
- HTTP GET (Vercel Cron) and POST (trusted external scheduler) at /api/public/hooks/sheets-sync.
- Require Authorization: Bearer CRON_SECRET. Generate/manage a strong secret outside source control.
- SHEETS_SYNC_CRON_ENABLED must be exactly true. Missing or any other value denies all requests.
- SHEETS_SYNC_OWNER_USER_ID must be the approved admin UUID. No value is configured by this code.
- Server checks approved+active profile and admin role, then loads only the integration for that same owner.
- Live read-only metadata confirms UNIQUE(user_id) on google_integrations.
- Respond with sanitized aggregate totals only. Errors return a generic failure, not candidate diagnostics.
- No cron schedule, production/preview environment variable updates, live sync calls or database migrations were performed.

## Outstanding release blockers
- Signed JWT user/API/browser testing, stage-history and recruiter ownership, least privilege RLS/column grants, triggered effects, backup/restore and independent review.
- The sync service is not transactional; partial candidate writes are possible before a later row fails.
- Verify idempotency, overlapping-run locks, rate/volume limits, Vercel scheduler behavior and secrets lifecycle in an isolated environment before activation.
- The 15 broad PUBLIC RLS policies, 13 anonymous non-invoker views, 16 privileged function grants and 16 anon TRUNCATE grants remain unresolved.
- Nine formal production release gates remain HOLD.
