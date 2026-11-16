# Build 62 — hosted UAT transport confinement and release evidence (DRAFT / HOLD)

## Changes actually committed
- All hosted preflight requests are now routed through a request gate permitting only `POST /auth/v1/token?grant_type=password`, `GET /auth/v1/user`, and `GET` on `profiles`, `user_roles`, and `candidates`, all on the fixed dedicated nonproduction origin.
- `redirect: "error"` is enforced for every preflight call so the HTTP client cannot automatically forward tokens/API keys to redirected destinations.
- New synthetic tests inspect every request to ensure route/method/origin/redirect compliance and reject malformed anonymous candidate data, plus prior Build61 exact-row and privilege-contamination tests.
- The existing security workflow's PR path filters now cover `security/build61/**` and `security/build62/**`. The existing `build54-guarded-candidate-release` job runs the updated hosted preflight test file on every branch push.

## What this does NOT close
No live hosted GoTrue users, seeded production-equivalent synthetic candidate fixtures or accepted 140-case hosted browser/API UAT were created. This is **offline transport and preflight hardening**, not proof of real login compatibility. No production or staging Supabase mutations, migrations, imports, invoice operations, real-record downloads, external outreach or `main` merge.

## Formal readiness and estimate
Carry forward the last confirmed release gates until independently rechecked: 0/48 live security fixes, 0/140 accepted hosted cases, 0/9 signed security release gates, 0/6 full workstreams, 0 independent reviews. These are formal acceptance counts, not percent of code complete. Estimated remaining builds **6–10+ for guarded CRM merge** and **16–28+ for the entire Command Center**; uncertainty remains high because external hosted fixtures, real DR rehearsal and independent approvals—not additional source assertions—are on the critical path. Never count deliberately failing `production-release-hold` as a substantive CI failure.
