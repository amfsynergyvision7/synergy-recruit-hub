# Candidate recruiter assignment active-profile filter — verified 2026-11-10

Run #223: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42692045326

All three jobs succeeded: application build and TypeScript, **132 Node tests**, and **21 PostgreSQL PASS groups**.

The existing `src/routes/_app.candidates.tsx` recruiter dropdown queried `profiles` with `status='approved'` but omitted `is_active=true`. Draft fix commit `c17f4d563da86f33d83cd297eefbf4af7c73041d` adds `.eq('is_active', true)`. Static regression `security/build2/candidate-recruiter-active-filter.test.mjs` checks both conditions and passed in CI.

**Security boundary:** this is an application dropdown filter only. It does not validate assignment through direct API calls, background workflows, old clients, or admin assignments. The production `set_assigned_recruiter()` trigger remains default-only and production RLS is unchanged. Server-side authorization and role-based staging tests are still mandatory.

No production edits, merge, deploy, business-row reads, or external communication. All nine release gates remain false.
