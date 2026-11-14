# Build 54 — Genuine hosted Auth/UAT entry gate (READ ONLY)

`hosted-auth-preflight.mjs` performs a strict read-only preflight against the
**dedicated nonproduction Supabase project** `dhlhlasnaapzckjyvffn` *only*.
It uses three distinct actual GoTrue password sessions (admin, recruiter,
pending), calls `/auth/v1/user` to confirm the tokens, reads scoped
`profiles` and `user_roles` via RLS, and checks synthetic owned/cross-owner
candidates for admin/recruiter/pending/anon isolation. It never performs CRM
writes or logs tokens, emails, candidate names, user UUIDs or passwords.

Prerequisites (through an authorized secure secrets manager only; not in
GitHub source, logs or chat):
- `AMF_UAT_SUPABASE_URL=https://dhlhlasnaapzckjyvffn.supabase.co/`
- `AMF_UAT_ANON_KEY` (publishable anon key, never service-role)
- `AMF_UAT_ADMIN_EMAIL/PASSWORD`
- `AMF_UAT_RECRUITER_EMAIL/PASSWORD`
- `AMF_UAT_PENDING_EMAIL/PASSWORD`
- `AMF_UAT_OWNED_CANDIDATE_ID`, `AMF_UAT_OTHER_CANDIDATE_ID` for two
  **synthetic seeded test fixtures**, owned by different approved recruiters

Only if a separate authorization explicitly permits disposable hosted test
data creation can the missing Auth accounts and synthetic candidate fixtures
be provisioned. The current project has zero hosted Auth users and zero public
candidate tables, so this test is **not yet executable against the actual
project**. CI runs mock-only unit tests to prove URL restrictions,
cross-recruiter denial and fail-closed configuration.

**DO NOT count these mock tests as any of the formal 140 signed-user cases.**
The preflight is just the first gate for running those tests in a separately
authorized, production-equivalent nonproduction environment.
