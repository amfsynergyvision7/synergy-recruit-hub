# Build 42 — Supabase Auth-issued sessions against production-shaped RLS, ISOLATED CI

This Build 42 batch creates a **disposable GoTrue v2.197.0** (Supabase Auth) container and a **PostgREST v12.2.3** container on a GitHub Actions runner, with a disposable PostgreSQL 17 service. GoTrue registers and signs in nine synthetic users, issuing actual access JWTs. It does not use any hosted AMF Synergy Vision Supabase project or credentials.

The exact 15-table/31-policy source-shaped RLS fixture from Build41 is applied to the isolated database. The fixture UUIDs are replaced with Auth-issued user UUIDs via a controlled SQL update over only 15 synthetic table names and UUID columns. The 135 read and five write tests are then sent as real authenticated HTTP requests using the issued tokens. Two negative tests check anonymous and tampered signatures. Evidence contains case IDs and pass/fail only, never JWTs or passwords.

**NOT formal acceptance:** This validates self-hosted/disposable GoTrue issuance, not the hosted nonproduction Supabase instance, browser CRM UI, email confirmation/recovery, actual production functions/views/triggers or independent approval. Formal counters stay 0/140 signed-user UAT accepted, 0/48 production objects remediated and 0/9 release gates. Main remains unchanged; no live financial/CRM workflows are enabled.

Potential incompatibilities exposed by this test must be corrected before any production migration. Release HOLD.
