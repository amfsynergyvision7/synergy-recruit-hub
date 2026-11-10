# Seven-role authorization execution — draft-only handoff

**Status: NOT EXECUTED.** The 140 outcomes in `authorization-acceptance-matrix.json` are provisional management-review expectations, not production permissions or a verified result.

## Required environment and isolation
1. Obtain explicit source authorization for **schema-only** access, including permission to inspect function/view definitions; never export candidate or business rows.
2. Build a **disposable** PostgreSQL environment from an independently reviewed, complete schema-only source. Verify public and dependent schemas, roles, grants, extensions, functions, triggers and policies against a private fingerprint. The existing nonproduction database is not equivalent.
3. Use seven synthetic role contexts and exclusively synthetic records. A role label in the matrix is not itself a PostgreSQL principal; the execution harness must prove the effective role/JWT/claims mapping for each case.
4. Freeze approved expected outcomes before executing. Any management-dependent expectation must be resolved by authorized reviewers, not silently inferred.
5. Execute all 140 cases, including negative tests, in isolated transactions or resettable fixtures. For each record, capture the exact case ID, observed allow/deny, traceable test-log reference and independent reviewer.

## Machine-readable evidence format
A private JSON file must contain `fixture_type:"synthetic"`, `environment:"disposable"`, `source_scope:"approved_schema_equivalent"`, `schema_fingerprint:"sha256:<64 lowercase hex>"`, `executed_at` (ISO timestamp), `reviewer` (nonblank), and `results` with one object per matrix case: `{ "id": "...", "actual": "allow|deny", "evidence_ref": "..." }`. The offline CLI `node security/build2/authorization-evidence.mjs matrix.json evidence.json` fails on missing, duplicate, unexpected or mismatched outcomes and missing provenance. The evidence file must be retained privately; never commit business data or credentials.

## Limits and gates
A passing reconciler verifies **completeness and agreement of reported outcomes only**. It cannot authenticate the log references, prove tests actually ran, verify schema equivalence, validate browser UX, or authorize release. Independently inspect source scope, execution logs, role mapping, migrations, backup/rollback and the nine blocked release gates. Finance triggers remain inactive; no merge/deployment or staging/production writes.
