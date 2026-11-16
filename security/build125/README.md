# Build125 — Restrict personal directories, candidate activity and paused AI processing

## Why this change matters

The previous User Management route ran `select("*")` over all employee profiles and all user roles on every approved CRM session, even for users outside the administrator role. The Candidate Timeline similarly read `select("*")` over activity events including candidate names, recruiter names and unstructured notes, and subscribed to broad realtime INSERT events. The AI Match browser still offered buttons and a raw resume-text display path, although the underlying server's `candidate_ai_processing` external-effects hold is active.

## Safe, working draft changes

1. `crm-sensitive-route-access.ts` enforces exact signed account, approved and active profile, and administrator role for employee-directory and candidate activity metadata. AI browser use is compile-time paused until independent privacy, provider billing and model release approval; no environment flag can silently switch it on.
2. User Management refuses to fetch unless the administrator gate passes, minimizes profile and role columns, checks exact counts and 200-row upper limits, rejects duplicate/ambiguous role assignments, cancels stale requests on account/role changes and uses generic errors. Existing user mutations remain hard paused by `CRM_USER_ADMIN_MUTATIONS_ENABLED`.
3. Candidate Timeline becomes an admin-only **action metadata** page: id, timestamp, action type, module. It does not fetch candidate/recruiter names, notes, or subscribe to an unrestricted realtime table stream. It cancels stale pending reads.
4. Sidebar hides User Management, Activity Timeline and AI Matching unless the same access policy admits the current approved user.
5. AI Match page fails closed at its outer component before any job loads or Gemini server functions, and raw résumé text is not rendered. Crucially, `matchCandidateWithResume` server handler returns **only the scored match**, not raw extracted resume, candidate or job records. Errors shown in the browser are generic.
6. All code is **draft only**. Actual RLS, field grants, signed-user UAT and independently approved candidate/AI provider processing are not completed by these browser checks. No person records, external emails or provider calls are accessed during the offline tests.

## Verification

`node --test security/build125/private-route-access.test.mjs` plus fast and guarded CI. Test contracts check cross-role rejection, revoked status, profile ID mismatch, source code query boundaries, exact count and role ambiguity, missing raw error or résumé exports, server response minimization and the immutable AI hold.

## Release acceptance

No fixed scorecard gate is newly completed: no independent PR approval, no signed hosted UAT or production authorization, no accepted role-safe Postgres policy and no approved AI usage. Keep **26/100** until formal criteria are met.

## Fixed v1 progress status

Build124 **26/100** → Build125 **26/100**, delta **+0**. No fixed programme milestone closed; security engineering work reduces browser overfetching and raw AI resume disclosure without independently accepted server security and provider release. All financial, CRM writes and outbound holds continue. 12/43 evidenced, 31 open, 74 points remain. No real candidate or employee records were read as part of these source tests.
