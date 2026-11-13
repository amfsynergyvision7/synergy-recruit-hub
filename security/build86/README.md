# Build 86 — Record-Scoped Email Privacy and Release-Bound Remote Assets

**13 November 2026 | AMF Synergy Vision | Draft PR #12 | RELEASE HOLD**

## Objective and actual committed application changes

Build86 fixes real data-privacy and error-handling gaps in callable CRM server functions, while leaving all existing source-level release holds active. No customer or candidate information was downloaded, exported, emailed, or processed by external AI services. No database migration was applied.

1. **Email history and merge context now require record-level authorization.** Previously `listEmailHistory` and `getEmailMergeContext` in `src/lib/email.functions.ts` checked only approved user role; they then selected a caller-supplied candidate/client ID. This assumed database RLS would always limit cross-record queries. Build86 adds `src/lib/crm-email-record-access.server.ts`, a shared server-only verification step that first requires `assertApprovedRole(actorId, ["admin","recruiter"])`, then exactly one role membership using the signed user's Supabase client, then an existing selected record. Candidate history/template reads are permitted to admins or recruiters whose UUID exactly matches `candidates.assigned_recruiter`; client reads require admin. Every denial is generic and occurs **before** selecting history, related submissions, or profile names. It does not use a service-role bypass for the record lookup.
2. **Pure, independently tested ownership predicate.** `src/lib/crm-email-recipient-policy.ts` now exports `isCrmEmailRecordReadable`, a fail-closed pure check for valid signed actor UUID, admin or recruiter role, record existence, candidate assignee equality, and client admin-only scope. The existing stronger send-time `isCrmEmailRecipientBound` and SMTP release holds are unchanged.
3. **Data minimization and database-error redaction.** Email history now selects only `id, subject, status, created_at, to_email` needed by its UI rather than `*`. SQL/PostgREST error messages no longer appear in user-facing email history exceptions or raw `email_log` console diagnostics. The formerly raw PostgREST errors in the anonymous `listOpenJobs` and anonymous application candidate/submission insert paths have also been replaced with generic errors; the pre-existing `careers_publication` and `public_application` hard release holds remain active.
4. **Low-level logo HTTP privacy gate.** `src/lib/resume-pdf.server.ts` now asserts the unconditional `candidate_ai_processing` hold at `fetchLogoBuffer` itself **before** reading the project's base URL or fetching public Storage bytes. This closes a direct internal-call path not necessarily passing through the AI route. Build84's exact-tenant HTTPS public-storage origin, content size, timeout, zero-redirect and image-magic checks remain in place.
5. **`security/build86/crm-email-record-scope.test.mjs`** introduces **nine** pure behavior/source-contract tests: recruiter own-vs-other assignee checks, administrator/client access, invalid role/UUID/record denial, signed and unique-role lookup ordering, per-record history gating before metadata selection, merge-template gating before related submissions, preserved send-time email address ownership/SMPP release, the low-level image fetch privacy hold, and sanitized public careers error output. Both GitHub fast and guarded workflows now trigger on Build86 paths and run the nine tests.

## Verification

- First Build86 source/test pass **273/273 fast cases** before the final two logo/public-error tests.
- Latest pre-documentation fast CI at SHA `32306623129192a39590f5b8b8ddbfa6825df099`: **275/275 automated security tests PASS** [run 43383724939](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43383724939). Full guarded CI [run 43383725144](https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/43383725144) includes real disposable PostgreSQL17 source-shaped/38 synthetic records/135 policy read tests, application build/typecheck and intentional production-release-hold; its final conclusion MUST be verified independently.
- All tests are offline mocked/static/pure behavior. They do not count as GoTrue-signed hosted UAT or independent release acceptance.

## Live source-of-truth, no-release position

Latest read-only dedicated nonproduction `dhlhlasnaapzckjyvffn`: **0 Auth users, 0 profiles, 0 user_roles, 0 candidates, 0 installed public app RLS policies, 0 enabled application triggers**. Only the disposable CI PostgreSQL17 fixture exercised the source-shaped 38 invented records and 135 read cases. No hosted signed UAT happened this build.

Production `wusntntcqgtpgokggdzv` read-only security baseline remains **67 public legacy RLS policies, 19 anonymous TRUNCATE table grants, 13 public non-invoker views**. GitHub `main` remains `protected=false`; PR #12 is **DRAFT/unmerged, with zero independent reviews**. The independent release hold is intentionally active. No external communication, candidate data/financial workflow activation, production/staging SQL write, branch merge or deployment occurred.

**Formal release counters remain unchanged:** **0/48** accepted production security remediations, **0/140** signed hosted GoTrue/PostgREST UAT cases, **0/9** independent release gates signed, **0/6** full AI Command Center workstreams closed. Passing code tests is engineering progress but does not clear these gates.

## Critical path and conditional planning range

The connected Supabase management integration does not expose a safe, privileged Auth Admin `createUser` action or a protected secret-bearing runtime. Provisioning nine isolated `@example.invalid` Auth users must take place through an independently approved **server-only nonproduction** Auth Admin environment; no raw service-role key should be copied into chat, committed or passed to public endpoints. Next: create/verify nine test identities, seed and readback the 38 invented hosted records, independently approve/install the 15 read policies, run **135 actual GoTrue-signed HTTP read cases plus five separately controlled write cases**, complete browser/API/restore evidence, enable branch protection and independent review, perform and accept 48 production remediations and acquire all applicable HR/privacy/legal/finance sign-offs before `main` merge/deployment.

**Conditional estimate remains roughly 5–10+ substantive CRM release iterations and 15–30+ full six-workstream iterations, after protected Auth access and independent reviewers are available.** These are not finite countdowns while dependencies remain blocked.

Reference: [draft PR #12](https://github.com/amfsynergyvision7/synergy-recruit-hub/pull/12), [hosted UAT #13](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/13), [governance #14](https://github.com/amfsynergyvision7/synergy-recruit-hub/issues/14).
