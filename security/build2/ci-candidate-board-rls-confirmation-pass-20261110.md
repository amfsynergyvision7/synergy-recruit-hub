# Candidate Board RLS zero-row UPDATE confirmation — verified 2026-11-10

Source fix: `src/components/CandidateBoard.tsx`, commit `a4742210ad77211c7ff1daa07a16a2ec1b016f62`.

Previously `moveCandidate()` optimistically updated React state, issued `.update({stage:newStage}).eq('id',candidateId)`, and displayed success whenever the Supabase request had no error. With RLS, zero matched/authorized rows can yield no error; this was a potential false success.

Draft fix chains `.select('id, stage').maybeSingle()`, requires a returned row and exact requested stage before success, and reloads authoritative rows with an error toast when an error, missing row or unexpected stage is returned. This does **not** verify downstream billing/offer automation completion.

Contract test `security/build2/candidate-board-rls-confirmation.test.mjs` guards source-level confirmation and rollback ordering. GitHub Actions run #175: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42689114557 — both jobs succeeded; **127 Node tests, 19 PostgreSQL PASS groups**. This is a static code contract plus synthetic DB tests, not browser end-to-end testing.

Further review: `src/components/CrudModule.tsx` also uses update/delete mutations without row-return confirmation and may need similar treatment. Bulk operations need affected-row count and authorization-aware partial-success UX. Candidate stage transitions that generate downstream financial records still require explicit finance decisions.

Unmerged draft only, no production change, nine release gates blocked.
