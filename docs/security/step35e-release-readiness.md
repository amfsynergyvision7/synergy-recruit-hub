# Step 35E — Isolated hardening verification and release gates

Status: **NOT APPROVED FOR PRODUCTION**. This document is a working evidence register, not a release authorization.

## Scope and isolation
- Authorized branch: `security/step-35e-isolated-hardening`; do not merge into `main` without explicit approval.
- Isolated Supabase project: `dhlhlasnaapzckjyvffn`. Production Supabase project `wusntntcqgtpgokggdzv` is out of scope.
- Vercel branch Preview only; production deploy, live candidate data, external AI processing and outbound SMTP are prohibited.

## Verified evidence
- Vercel Preview of commit `795b446098903db30e44d551a1efeb98b2688cc1` reported READY. This establishes a successful Preview build, **not** end-to-end security acceptance.
- All eight `security_lab` tables reported RLS enabled and forced in the isolated project.
- Transactional, synthetic `authenticated`-role SQL checks passed: a synthetic user saw one owner-bound probe row, no other user's profile, and no candidate/job rows; authenticated users lack UPDATE privileges on `sec04_profiles.status` and `is_active`, while `full_name` remains editable.
- Reproducible isolated SQL assertion script: `tests/sql/step35e-isolated-rls-check.sql`.
- Outbound AI and SMTP transport modules have unconditional denial before their environment approval checks; external operations remain disabled.
- Node source-level regression tests are committed under `tests/` and wired into `.github/workflows/step35e-security-gates.yml`. GitHub Actions completion has **not** been independently verified.

## Outstanding acceptance checks
1. Obtain a confirmed GitHub Actions test conclusion and logs for the latest commit. A Vercel READY status alone is insufficient.
2. Run integration tests against a synthetic CRM-compatible schema with `public.profiles`, `user_roles`, `candidates`, `job_openings`, `clients` and appropriate RLS, without copying production records. The current `security_lab` fixture is not a complete CRM replica.
3. Test negative and positive authorization cases with separate synthetic identities, including role changes, profile revocation, cross-owner record reads, email recipient mismatch and server-function calls.
4. Inspect all remaining differences from `security-isolation-test`; selectively port reviewed changes only. Do not blindly merge.
5. Conduct dependency, secret-exposure, build/runtime and operational rollback reviews.
6. Obtain explicit management approval for any production merge/deploy, external AI processing, SMTP dispatch, legal/policy activation or handling of live records.

## Release decision
**HOLD.** Source-level assertions, isolated RLS tests and successful Preview builds do not establish full end-to-end readiness. Maintain the deny-by-default gates and preserve production isolation.
