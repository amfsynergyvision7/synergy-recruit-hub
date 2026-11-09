# Expanded negative authorization test evidence — 2026-11-10

GitHub Actions run: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42681072448

Commit tested: `581bf93a28e5de01b5887c6f6b746aa604e629b4`.

Results:
- `isolated-postgres-view-rls`: **success**. Log includes `UPDATE 1` and `PASS: synthetic security-invoker view and column grants respect recruiter RLS`.
- `offline-security-tests`: **success**.

The synthetic PostgreSQL 17 fixture tests:
1. Anonymous SELECT grant denial and anonymous helper EXECUTE denial.
2. Recruiter A can view only assigned candidate A; recruiter B only candidate B.
3. Recruiter A can update the permitted `full_name` field.
4. Recruiter A cannot update candidate B.
5. Recruiter A cannot change `assigned_recruiter` (column-level grant restriction).
6. Missing identity yields no candidate view rows.
7. A `security_invoker=true` view enforces base-table RLS.

**Important limitations:** The actual 19-table schema and all 13 real views are not reproduced in this fixture. The real privileged functions, administrative UI, billing, notifications, email logging, workflow triggers and rollback remain untested. This evidence must not be used to set `isolated_postgresql_rls_tests_passed` to true for the overall release.

All nine production release gates remain blocked; no production database changes were made.
