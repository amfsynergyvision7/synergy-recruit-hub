# Build 37 — DB-backed synchronization lease: REVIEW ONLY

Draft code now calls service-role-only PostgreSQL claim, refresh and release functions, with fail-closed handling for a missing RPC or expired lease. The actual SQL is in security/build37/sync-lease-review-only.sql, **not** in an active migration folder, and must not be applied to production without an independently reviewed release.

Scheduler activation remains explicitly disabled by default (SHEETS_SYNC_CRON_ENABLED must be true, CRON_SECRET and the approved owner ID must be supplied out-of-band). Neither secrets nor cron configuration are added.

The real source integrates a heartbeat at fetch and candidate data mutation checkpoints. The new PostgreSQL SQL contract is tested only on an ephemeral PostgreSQL 17 CI container, including role EXECUTE denial for anon and authenticated, service_role authorization, stale-token rejection, expiry takeover, and removal of synthetic objects.

CRITICAL RELEASE BLOCKERS: a 15-minute TTL and per-row heartbeat do not provide transactional fencing against a long in-flight write. Candidate email/mobile columns are not uniquely constrained. Inserts, updates and notifications are not atomic; partial failures can persist. Independent review, source-equivalent signed-user tests, protected main, verified restore, database access remediation and all nine release gates remain required. No staging or production writes, migrations, scheduling, real candidate synchronization, or financial activation.
