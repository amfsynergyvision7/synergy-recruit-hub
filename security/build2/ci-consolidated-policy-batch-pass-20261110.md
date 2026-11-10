# Consolidated security regression batch — verified 2026-11-10

**Run #66:** https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42683163903

Tested commit: `0f508b0fc06724487223f7dcc0828a135e429465`.

Both CI jobs succeeded. PostgreSQL log confirms six PASS checks:
1. Synthetic security-invoker view and column grants respect recruiter RLS.
2. Synthetic RPC grants deny anonymous EXECUTE inherited from PUBLIC.
3. Synthetic invoker aggregate view respects recruiter RLS and billing grant denial.
4. Live-column-shaped candidate view denies cross-recruiter, inactive and missing-identity reads.
5. Synthetic live helper predicates and self-scoped RPC deny pending, inactive, anonymous and arbitrary-ID access.
6. **Actual 15-table review-only SQL compiles** in disposable PostgreSQL and passes synthetic legacy-policy cleanup, anonymous privilege revocation, recruiter ownership and unapproved identity checks.

The first batch attempt failed because the same PostgreSQL service already contained `authenticated` and `anon` roles from prior fixtures. The fixture generator was corrected to reuse roles/schema, then run #66 passed.

## Scope and explicit limits

This executes the actual draft policy statements against **generic synthetic table stubs**, not a faithful production-schema clone. The helper functions are synthetic approximations; production grants, 19-table coverage, 13 actual view definitions, 16 privileged functions, real UI/API compatibility, complete role matrix, rollback and deployment are **not** verified.

No production records accessed or changed; no production DDL, deploy, PR merge, or external communication. All nine release gates remain blocked. Do not promote this evidence into a production-ready declaration.

## Batch operating procedure

- Modify related review-only fixtures and checks on the dedicated draft branch.
- Run the complete `Security Build 2 offline checks` GitHub Actions workflow automatically per commit.
- Inspect both job conclusions and PostgreSQL PASS/ERROR lines.
- Record one evidence note for the successful batch; fix failing fixtures before adding further scope.
- Keep `release-evidence.json` all false until separate real-world release-gate evidence and authorization exist.
