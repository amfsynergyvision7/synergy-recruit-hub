# Additional exposed-schema access findings — 2026-11-09

Read-only catalog review of all 19 public base tables; no application rows accessed.

## Beyond the original 15-table scope
**`app_settings`** (RLS enabled)
- `public read app settings`: SELECT to `anon, authenticated`, USING `true`.
- Columns include `logo_url`, `resume_import_folder_url`, `default_color_theme`, `updated_by`. The resume-import URL should not automatically be treated as safe public configuration.
- `admin update app settings`: UPDATE for authenticated users using `has_role(auth.uid(),'admin')` without `is_approved` check. Inactive admin role holders may retain permission.

**`email_log`** (RLS enabled)
- `read email_log`: SELECT to authenticated with `is_approved(auth.uid())` only. This is all-approved-user read access to recipient addresses, message subject/body, provider identifiers and errors; no sender or ownership restriction.
- `insert email_log`: INSERT to authenticated with `has_role(admin) OR has_role(recruiter)` and no `is_approved` check. Inactive role holders may be able to insert records.

**`workflow_rules`** (RLS enabled)
- Only policy allows admin management based on `has_role` without `is_approved`; see `workflow-privilege-dependency.md`.

**`candidate_stage_history`** (RLS enabled)
- No RLS policies; ordinary end-user API reads should be denied despite table-level grants. Existing history UI may rely on privileged views or functions.

## Required revised scope
- **19** public base tables inventoried; the original 15-table migration draft does not cover `app_settings`, `email_log`, `workflow_rules`, or `candidate_stage_history`.
- Validate whether anonymous branding configuration is truly needed. Prefer a minimal public view or API exposing only logo/theme rather than the full `app_settings` row.
- Restrict email logs to admins and authorized senders/owners, with approved/active checks; do not assume all approved users should read recipient addresses and bodies.
- Add approved/active checks for workflow rules and app settings writes, and email-log inserts.
- Preserve legitimate automation, branding, email audit, and history UI workflows through caller mapping and synthetic-account integration tests.
- Confirm effective grants and view/RPC bypasses; RLS policies alone do not close every access path.
- No production DDL until isolated tests, rollback rehearsal and explicit release authorization.

**State:** verified inventory only; production unchanged.
