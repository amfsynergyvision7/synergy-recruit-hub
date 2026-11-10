# Offline schema-parity comparison — handoff

This is a draft-only tool. It compares two locally supplied **catalog-metadata-only** JSON snapshots. It never connects to a database or reads business rows. Do not commit actual catalog exports if they contain confidential function/view definitions, connection details, or literals.

## Command
`node security/build2/schema-parity.mjs /private/expected-metadata.json /private/actual-metadata.json`

Exit code 0 means the supplied snapshots match across all nine sections. Exit code 1 means mismatch, missing section, invalid input or a duplicate identity. The tool does **not** prove that a snapshot is complete, current, authentic or representative of production.

## JSON contract
Each input is an object containing arrays named `tables`, `columns`, `constraints`, `indexes`, `views`, `functions`, `policies`, `triggers`, and `grants`. Rows use the column names from the corresponding read-only catalog queries in `metadata-snapshot-readonly.sql`. Both sides must use the same projection for each section. Compare full row definitions, not only object counts.

## Acceptance criteria
1. All nine required sections exist in both inputs.
2. Every row has a complete stable object key; duplicate keys fail.
3. Missing, unexpected and definition-changed objects fail.
4. Test fixtures cover each section and negative outcomes.
5. Complete source and target metadata snapshots must be independently verified before this result is used in a release review.

## Important limits
The read-only catalog exporter `schema-parity-export-readonly.sql` now produces all nine sections as one JSON object. Its synthetic PostgreSQL CI check verifies identical snapshots and rejects an introduced schema change. The exporter has not been run against an approved full production-schema-equivalent database; source snapshot completeness and authenticity remain unverified. Production-schema-equivalent testing, full role and browser acceptance, and independent approval are **not** completed by this comparator. All release evidence flags remain false.

## Approved-environment handoff checklist (not authorization to access)
- Obtain separate confirmation that the source is approved for read-only catalog extraction, including function/view source visibility and confidential literal handling.
- Confirm the source PostgreSQL major version, role grants and schema search path; export only the nine catalog sections with the read-only exporter.
- Keep snapshots in an access-controlled temporary workspace, not GitHub commits, CI artifacts or public logs.
- Build the target from independently reviewed schema-only migration scripts in a disposable local PostgreSQL instance; do not clone or restore business records.
- Compare snapshots, investigate every missing/extra/changed object, then run the role authorization matrix with synthetic identities.
- Record source timestamp, version, reviewer, exact source/target scope and a checksum of the *private* export in a restricted evidence register.
- A passing comparator is not a release authorization; require independent review, full acceptance and explicit management approval.
