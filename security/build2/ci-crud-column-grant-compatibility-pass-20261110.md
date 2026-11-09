# Candidate form and column-grant compatibility — verified 2026-11-10

Run #218: https://github.com/amfsynergyvision7/synergy-recruit-hub/actions/runs/42691717048

All three jobs passed: application build and TypeScript, **131 Node tests**, and **21 isolated PostgreSQL PASS groups**.

Draft source fix `src/components/CrudModule.tsx` commit `e604abeaa38cc9ea2b355d9737556f84124eb880`: editing an existing record now constructs a payload from fields whose normalized values differ from the loaded row, instead of sending every form field. If no values changed, the dialog closes without an unnecessary UPDATE. Dependent candidate/client/job UUID fields are also only propagated when changed. The candidate `assigned_recruiter` field is omitted from Add/Edit and bulk-edit field lists unless `role === 'admin'`; the server-side RLS and column grants must still enforce authorization. Existing admin reassignment UI remains available pending reviewed server authorization.

Regression `security/build2/crud-column-grant-compatibility.test.mjs` verifies the source contract. This addresses the discovered compatibility issue between restricted `UPDATE(stage,status,...)` grants and broad full-form update payloads.

**Residual risks:** String comparison of field values is a pragmatic source-side filter, not a canonical database diff for dates, numeric formatting, objects or concurrent edits. Full-field validation, stale-row conflicts and authorized admin assignment remain staging/browser E2E gates. Hidden UI fields do not protect the API from direct requests. Proposed production grant matrix still inactive.

No production changes, no merge/deployment, no financial or workflow authorization. All nine release gates remain false.
