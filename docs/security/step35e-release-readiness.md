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


## Verification checkpoint — 2026-11-15
- Vercel isolated Preview for commit `f240256c13adba105dacf199e5a27494bcae9402` is **READY**; build logs confirm the mandatory security suite was invoked. The available log response did not expose a complete test summary, so do **not** infer a fresh test count from this Preview.
- Isolated Supabase catalog read: all eight `security_lab` tables have RLS enabled and FORCE RLS enabled; four intentionally have zero policies.
- Selectively reviewed `security-isolation-test/tests/fixtures/sec11_outbox_constraints_regression.sql` and **executed it** on isolated project `dhlhlasnaapzckjyvffn` inside BEGIN/ROLLBACK. Duplicate idempotency key, missing consent and external-domain recipient insertions were rejected as expected. The result reported `synthetic_held_count=1`, `max_attempts=0` before rollback. The verified fixture is now copied into `tests/sql/step35e-isolated-outbox-constraints.sql`; no live email was sent.
- This verifies representative database constraints only; it does **not** prove SMTP delivery, retries, outbox worker authorization, or production-schema behavior. GitHub Actions completion and latest new-commit Preview remain unverified.


## Verification checkpoint — 2026-11-16
- Isolated Vercel Preview for commit `097b8802a4546be3906e6f46d70a7f9c852cc95d` reports **READY**, with build logs showing `Deployment completed`. The returned events do not contain a complete TAP test summary, so no new test pass count is asserted.
- GitHub commit workflow lookup for that SHA returned zero PR-triggered runs. Because this lookup is PR-scoped, it does not prove the branch push workflow passed or failed.
- Read-only inspection of `security_lab.sec11_outbox` confirmed a restrictive trigger and constraints: only `held`/`cancelled` states, zero attempts, immutable recipient/identity fields, and no deletion.
- Executed a rollback-only SQL regression in isolated Supabase `dhlhlasnaapzckjyvffn`: six invalid mutations were rejected (missing suppression, sending state, nonzero attempts, consent removal, recipient modification, and deletion); a valid synthetic held intent remained unchanged within the transaction. Result: `PASS: six outbox mutation denials; rollback follows`. Fixture: `tests/sql/step35e-isolated-outbox-mutation-guards.sql`. This is synthetic constraint/trigger evidence, not outbox worker or production readiness.
- Selectively reconciled the outbox mutation-guard test concept from `security-isolation-test` without merging its broad schema migrations. Full synthetic CRM schema and six-role runtime verification remain outstanding.

## Outstanding acceptance checks
1. Obtain a confirmed GitHub Actions test conclusion and logs for the latest commit. The Vercel build independently ran the 19-test suite, but GitHub Actions execution remains unverified.
2. Run integration tests against a synthetic CRM-compatible schema with `public.profiles`, `user_roles`, `candidates`, `job_openings`, `clients` and appropriate RLS, without copying production records. The current `security_lab` fixture is not a complete CRM replica.
3. Test negative and positive authorization cases with separate synthetic identities, including role changes, profile revocation, cross-owner record reads, email recipient mismatch and server-function calls.
4. Inspect all remaining differences from `security-isolation-test`; selectively port reviewed changes only. Do not blindly merge.
5. Conduct dependency, secret-exposure, build/runtime and operational rollback reviews.
6. Obtain explicit management approval for any production merge/deploy, external AI processing, SMTP dispatch, legal/policy activation or handling of live records.

## Release decision
**HOLD.** Source-level assertions, isolated RLS tests and successful Preview builds do not establish full end-to-end readiness. Maintain the deny-by-default gates and preserve production isolation.

## Verification checkpoint — 2026-11-19
- The latest authorized-branch Vercel Preview for commit `b0980f082e32e32e27e59aa8377796a22ea781fc` is **READY** (deployment `dpl_FNDqydK4ofPrdGtgCN95N3fSmrr1`); its predecessor `8c5cae29fb7cde50ef5b5629c19d13e65e768091` is also **READY**. Build events confirm invocation of `node --test`, successful application build and `Deployment completed`, but do not expose a full test pass/fail summary. Do not claim a new test count.
- Build tracing emitted unresolved optional-dependency warnings for `@opentelemetry/api`, `bufferutil`, and `utf-8-validate`; investigate runtime necessity before acceptance. A READY deployment alone does not resolve these warnings.
- GitHub's commit-workflow lookup for `b0980f08` returned no runs, but this endpoint is limited to pull-request-triggered runs. The push-triggered Actions workflow is therefore **unverified**, not failed.
- Read-only isolated Supabase catalog inspection: all eight `security_lab` ordinary tables have RLS and FORCE RLS enabled; four have zero policies. No isolated DB writes were made in this checkpoint.
- Branch comparison: authorized branch is 58 commits ahead of `main`, zero behind, with 22 changed files. `security-isolation-test` diverges (68 commits ahead and 58 behind relative to the authorized branch); do not wholesale merge. Its extra SQL fixtures require per-file review and isolated execution.
- Source review confirms `requireCrmRecordAccess` verifies `auth.getUser()` identity before profile, role and record queries. This is source-level verification only; negative runtime tests with distinct JWTs remain necessary.
- **Release HOLD** remains mandatory until full synthetic CRM schema, multi-role runtime authorization, migration/rollback, audit and outbox-worker tests, independent CI results and release approvals are verified.
