# Stage-history isolation batch — verified 2026-11-10

GitHub Actions run #124: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42685980084

Tested commit `d75e3a520aa24a891e1a605c07e005799750b61a`. Both CI jobs succeeded, PostgreSQL logs show **13 PASS groups** including:

`PASS: stage-history RLS isolates assigned candidate, inactive/missing users and denies browser writes`

The new synthetic fixture uses seven exact production column names/types, with an independent test identity function and synthetic candidates, profiles and history. It validates A/B recruiter isolation, inactive/missing identity denial, NULL candidate denial and absence of direct authenticated write privileges and anonymous read privileges.

An earlier run #122 failed on the first recruiter-isolation assertion because the test reused a session identity setting altered by earlier fixtures. This was fixed by isolating the fixture's identity function and setting. No production issue was inferred from the test failure.

**Not yet validated:** real stage-history triggers, actual policies on production, direct admin history UI, service writer identity, rollback, and full application compatibility. This fixture is not a production migration. Production unchanged; nine release gates blocked.
