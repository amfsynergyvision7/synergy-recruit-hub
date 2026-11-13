# Step 35E — Isolated hardening verification and release gates

Status: **NOT APPROVED FOR PRODUCTION**. This document is a working evidence register, not a release authorization.

## Scope and isolation
- Authorized branch: `security/step-35e-isolated-hardening`; do not merge into `main` without explicit approval.
- Isolated Supabase project: `dhlhlasnaapzckjyvffn`. Production Supabase project `wusntntcqgtpgokggdzv` is out of scope.
- Vercel branch Preview only; production deploy, live candidate data, external AI processing and outbound SMTP are prohibited.

## Verified evidence
- Vercel Preview of commit `47551d87f211db368d86c6ae2a19df2d003a5046` reported **READY**. The actual custom `scripts/vercel-build.mjs` entrypoint first executed `npm run test:security`; build logs recorded **19 tests, 19 passed, 0 failed, 0 skipped**, followed by the Vite build. This confirms the committed security suite executed in Preview, **not** end-to-end security acceptance.
- All eight `security_lab` tables reported RLS enabled and forced in the isolated project.
- Transactional, synthetic `authenticated`-role SQL checks passed: a synthetic user saw one owner-bound probe row, no other user's profile, and no candidate/job rows; authenticated users lack UPDATE privileges on `sec04_profiles.status` and `is_active`, while `full_name` remains editable.
- Reproducible isolated SQL assertion script: `tests/sql/step35e-isolated-rls-check.sql`.
- Outbound AI and SMTP transport modules have unconditional denial before their environment approval checks; external operations remain disabled.
- Node regression tests are committed under `tests/`, invoked from the actual Vercel build entrypoint, and wired into `.github/workflows/step35e-security-gates.yml` using the canonical `npm run test:security` command. GitHub Actions completion has **not** been independently verified.

## Verification checkpoint — 2026-11-13
- Vercel isolated Preview commit `8306aa07f23374f124456a683441bb88fb1a57fd` reported **READY**. Build events show the mandatory `test:security` invocation and deployment completion. This does not establish end-to-end authorization.
- Isolated Supabase catalog inspection: eight `security_lab` ordinary tables all have `relrowsecurity=true` and `relforcerowsecurity=true`; four have zero policies. This is structural evidence, not a complete role-by-role behavioral test.
- Compared `security-isolation-test` against this branch; its 2026-11-09 batch report describes synthetic six-role SELECT and outbox guard tests, but also explicitly says the complete CRM public schema is absent. Do not treat those results as full-schema acceptance or blindly merge fixture changes.
- Added an isolated workflow non-deployment regression assertion on this branch. Its new commit must be independently verified by a subsequent Preview test log before counting it as passed.
- GitHub Actions execution status remains unverified; the available commit-workflow lookup is PR-run scoped and cannot establish the push workflow conclusion.

## Outstanding acceptance checks
1. Obtain a confirmed GitHub Actions test conclusion and logs for the latest commit. The Vercel build independently ran the 19-test suite, but GitHub Actions execution remains unverified.
2. Run integration tests against a synthetic CRM-compatible schema with `public.profiles`, `user_roles`, `candidates`, `job_openings`, `clients` and appropriate RLS, without copying production records. The current `security_lab` fixture is not a complete CRM replica.
3. Test negative and positive authorization cases with separate synthetic identities, including role changes, profile revocation, cross-owner record reads, email recipient mismatch and server-function calls.
4. Inspect all remaining differences from `security-isolation-test`; selectively port reviewed changes only. Do not blindly merge.
5. Conduct dependency, secret-exposure, build/runtime and operational rollback reviews.
6. Obtain explicit management approval for any production merge/deploy, external AI processing, SMTP dispatch, legal/policy activation or handling of live records.

## Release decision
**HOLD.** Source-level assertions, isolated RLS tests and successful Preview builds do not establish full end-to-end readiness. Maintain the deny-by-default gates and preserve production isolation.
