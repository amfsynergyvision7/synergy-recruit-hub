# Consolidated RPC grant batch — verified 2026-11-10

GitHub Actions run #92: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42684264390

Tested commit `ca639e02f18d0d985da6da996179b73352fe8261`; both jobs succeeded. PostgreSQL logs contain **10 PASS groups**, including:

`PASS: actual privileged RPC GRANT proposal denies anon, retains authenticated helpers and internal scheduler principal`

The test executed the real review-only `privileged-rpc-grants-review-only.sql` against synthetic PostgreSQL functions, checked seven anonymous EXECUTE restrictions, preserved authenticated helper access and checked an explicit synthetic internal scheduler principal.

**Important:** the synthetic scheduler principal is **not** a verified live scheduler identity. No production functions, scheduled jobs or business records were changed or invoked. This does not resolve arbitrary-ID enumeration for authenticated callers, function body safety, or app caller compatibility.

All nine production release gates remain blocked. PR remains draft and unmerged.
