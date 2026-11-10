# Offer editor close / candidate lookup race — 2026-11-10

Draft-only code change: closing the CRM editor invalidates outstanding asynchronous offer candidate lookups before updating dialog visibility. Existing lookup sequence checks prevent stale responses from applying to the form after closing and reopening. Added static regression tests `crud-offer-dialog-close-race.test.mjs`.

CI run #376: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42702559426
All three jobs passed: application build/TypeScript, offline security, isolated PostgreSQL.

Limitations: static regression tests do not replace browser-based interaction tests. Candidate-switch field-clearing semantics require product/management confirmation; this change deliberately does not alter stored offer associations or financial values. No database writes, merge, deploy, policy changes or external communications. All nine release gates remain false.
