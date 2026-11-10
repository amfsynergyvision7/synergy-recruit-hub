# Locally executed release-gate test evidence — 2026-11-10

**Scope:** Node.js release-gate behavior only; no PostgreSQL test and no production change.

Environment: Node.js v22.16.0 in the assistant's isolated execution container.

Inputs: local copies of the current branch's `release-gate.mjs`, `release-evidence.json`, and `release-gate.test.mjs`, verified against their GitHub connector contents. These are local copies, not a CI run.

Commands:
```sh
node --test release-gate.test.mjs
node release-gate.mjs
```

Observed:
- `node --test`: **12 tests passed, 0 failed**, duration approximately 826 ms.
- Release gate: all nine conditions printed `BLOCK`.
- Gate exited with code `1` and printed `PRODUCTION RELEASE BLOCKED: independently verifiable evidence missing.`

**Limitations:** This does not establish that all repository tests pass; the remaining SQL contract tests and isolated PostgreSQL integration tests have not been executed. The gate currently trusts self-declared evidence strings and still requires independent manual verification. Do not mark any release evidence as passed on the basis of this report.

**Production status:** unchanged; release blocked.
