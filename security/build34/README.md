# Build 34 — isolated source security review (NOT FOR MERGE)
This branch is independent from the 145-file draft Security PR #11 and must remain review-only.
- Sync POST requires a strong server-only CRON_SECRET. Missing or incorrect credentials fail before any integration lookup.
- The existing route is POST; native Vercel Cron invokes GET. Do not enable a native Cron schedule without a reviewed protocol change.
- The existing cron path still picks the latest saved integration when no user ID is specified: tenant-scoping is a release blocker.
- Admin integration functions now require server-verified approved/active profile and admin role.
- Six AI/import operations have approved/active role guards (AI Admin/Recruiter; bulk import Admin only).
- These guards do not replace database least-privilege RLS, column grants or actual signed-user tests. Critical live database findings remain.
- A preview build, if automatically created, is not a release approval. No staging/production DB writes, external emails, real sync or financial activation are authorized by these tests.
- Run signed synthetic JWT/API/browser tests, scheduler compatibility, tenant-binding, rollback and independent review before merging.
- Nine formal release gates remain blocked.
