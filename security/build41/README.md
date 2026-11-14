# Build 41 — Signed-JWT authorization across disposable PostgREST + PostgreSQL 17

- 31 actual SQL RLS policies from the Build38 source-shape fixture, 15 production-shaped tables and synthetic rows/roles.
- Separate PostgREST v12.2.3 Docker container verifies real HMAC-SHA256 JWT signatures, authenticating nine synthetic subject IDs with the authenticated role.
- 135 HTTP GET cases and five mutation cases are derived from the historical 140-case matrix. Four negative token tests cover expired, malformed, tampered and anonymous requests.
- All credentials in CI are deliberately synthetic, not Supabase secrets. The runner writes a case-level JSON evidence file without any token or actual candidate information.
- This tests real signed HTTP JWT authorization on a disposable PostgREST stack, **not** Supabase Auth user issuance, real CRM browser access, or an independently accepted full formal test plan.
- Formal counters stay 0/140 accepted, 0/48 production security objects remediated, 0/9 release gates until separately signed off. No production writes, merge, rollout, scheduled sync, or finance changes. RELEASE HOLD.
