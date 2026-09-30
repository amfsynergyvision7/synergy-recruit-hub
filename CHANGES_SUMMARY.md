# AMF Synergy Vision CRM — Zoho Gap-Closing Plan: What Was Built

This covers all six pieces built after the Zoho feature comparison, in the order they were delivered. Each section says what it is, which existing feature it extends, exactly where to find it (in the running app, in the codebase, and in Supabase), and why it exists.

---

## Step 1 — Real Reminder Automation

**Feature extended:** Notifications (previously a page with only a manual "send test notification" button — nothing generated reminders on its own).

**What it does:** An hourly job scans your data and creates real notifications for four situations: an interview scheduled for tomorrow, an invoice overdue by 15+ days, a joining date that's arrived but nobody confirmed the candidate actually joined, and a candidate stuck in the same pipeline stage for 7+ days with no update. Each reminder is created once — re-running the job never duplicates an existing one.

**Where to find it:**
- *In the app:* the **Notifications** page in the sidebar — reminders now appear there on their own, with an icon per type.
- *In the code:* `src/routes/_app.notifications.tsx` (the icon-per-type mapping).
- *In Supabase:* SQL Editor → search for the function `generate_reminders()` and the scheduled job named `generate-reminders-hourly` (Database → Cron Jobs, or `SELECT * FROM cron.job;`). The migration that created both is `supabase/migrations/20260929060000_reminder_automation.sql`.

**Purpose:** so recruiters and finance stop needing to remember to check — the CRM tells them.

---

## Step 2 — Email Sending (via SMTP, currently Gmail)

**Feature extended:** Candidates and Clients modules.

**What it does:** A mail icon next to any candidate or client with an email address opens a compose dialog with four canned templates (interview invite, status update, offer follow-up, or a blank one) plus `{{name}}` substitution. Sending goes through a real mailbox you own over SMTP (currently a Gmail account, since Zoho's free plan doesn't expose SMTP access), and every send (successful or failed) is logged with a "previously sent" history visible in the same dialog.

**Where to find it:**
- *In the app:* open **Candidates** or **Clients**, look for the small mail icon in each row's actions (also in the detail panel and mobile card view).
- *In the code:* `src/components/EmailComposeDialog.tsx` (the dialog), `src/lib/email.server.ts` (the SMTP send via `nodemailer` — provider-agnostic by design, configured entirely through environment variables), `src/lib/email.functions.ts` (the server function that checks the sender's role before sending and logs the result), `src/components/CrudModule.tsx` (the `emailField` prop that turns the mail icon on).
- *In Supabase:* table `email_log` holds every send attempt. Migration: `supabase/migrations/20260929070000_email_log.sql`.
- *Requires:* the `SMTP_USER` and `SMTP_PASSWORD` (a Gmail App Password — requires 2-Step Verification turned on for that Google account, not the account's normal login password) environment variables set on Vercel — without these, sends will fail with an error toast (nothing silently breaks). `SMTP_HOST` defaults to `smtp.gmail.com` and `SMTP_PORT` to `465`; both can be overridden later to switch providers without any code change.

**Purpose:** send real, trackable emails without leaving the CRM.

---

## Step 3 — Interview Scheduling Links

**Feature extended:** Interviews module.

**What it does:** A recruiter proposes up to three interview time slots; the CRM generates a one-time public link (no candidate login) they can text or email over. The candidate opens the link, sees your branding, and picks a slot. The moment they do, the interview is marked "Scheduled" with that exact date/time — which automatically triggers your existing pipeline automation to advance the candidate's stage — and the recruiter gets a notification through the same feed from Step 1.

**Where to find it:**
- *In the app:* open **Interviews**, look for the "Get link" / "View link" / "Reschedule" button in each row. The public page itself lives at `/schedule/<token>`.
- *In the code:* `src/components/ScheduleLinkButton.tsx` (the recruiter-side button/dialog), `src/routes/schedule.$token.tsx` (the public candidate-facing page), `src/lib/scheduling.functions.ts` and `src/lib/scheduling.ts` (the logic).
- *In Supabase:* `interviews` table gained two columns, `scheduling_token` and `proposed_slots`. Migration: `supabase/migrations/20260930050000_interview_scheduling_links.sql`.

**Purpose:** let the candidate self-schedule instead of a recruiter playing phone/email tag over available times.

---

## Step 4 — Data Export & Reporting

**Feature extended:** every module (Candidates, Clients, Jobs, Submissions, Interviews, Offers, Billing, Users) plus a brand-new **Reports** page.

**What it does:** Every module's table now has an **Export CSV** button that downloads exactly what's currently on screen — whatever your Search box and Filters panel have narrowed it down to. Separately, the new Reports page lets you pick a date range (or a 7/30/90-day preset, or "All time") and pulls four tables: Candidate Pipeline by Stage, Recruiter Performance, Client-wise Pipeline Summary, and Billing Summary by Client — each with its own CSV export.

**Where to find it:**
- *In the app:* the Export CSV button sits in the toolbar of every module (next to "Clear filters"). The **Reports** page is in the sidebar, right under Dashboard.
- *In the code:* `src/lib/csv.ts` (the shared CSV-building/download helper used everywhere), `src/components/CrudModule.tsx` (the per-module export button), `src/routes/_app.reports.tsx` (the Reports page itself).

**Purpose:** get pipeline and billing data out of the CRM and into a spreadsheet for analysis, handoffs, or anything the built-in Dashboard charts don't cover.

---

## Step 5 — Configurable Workflow Builder

**Feature extended:** brand-new **Workflow Rules** page (Admin section of the sidebar, admin-only).

**What it does:** Until now, every automated behavior (stage advancing, the four reminder kinds) was hardcoded in a migration. This page lets an admin define new "when a field changes to a value, then do something" rules from a form — no code, no deploy. Two actions are available: send an in-app notification (to the assigned recruiter or to everyone with a given role), or update a different field on that same record to a fixed value. One generic database trigger reads and runs these rules the moment a matching record changes.

**Where to find it:**
- *In the app:* sidebar → **Admin** section → **Workflow Rules** (visible to admins only).
- *In the code:* `src/routes/_app.workflow-rules.tsx` (the whole UI — table/field/value dropdowns, the rule list).
- *In Supabase:* table `workflow_rules` holds every rule; function `run_workflow_rules()` is the trigger logic, attached to `candidates`, `submissions`, `interviews`, `offers`, `billing`, and `clients`. Migration: `supabase/migrations/20260930060000_workflow_rules.sql`.

**Purpose:** let you add new "if this, then that" automation yourself, going forward, without asking for a code change every time.

---

## Step 6 — Careers Page (Job Board Posting)

**Feature extended:** Jobs module, plus two brand-new public pages.

**What it does:** Every open job now has a public, no-login page a candidate can apply to directly — the practical stand-in for posting to a real job board (which would need a paid Indeed/Naukri/LinkedIn partner account this prototype doesn't have). There's also a public index listing every open role. Applying reuses your existing duplicate-candidate matching (so a candidate who already exists doesn't get a second record), lands as a normal submission tied to that job, and notifies the assigned recruiter. Each job also has a "Confidential Client" toggle that hides the hiring company's name on the public page when checked.

**Where to find it:**
- *In the app:* the public pages are at `/careers` (list) and `/careers/<job id>` (one job + apply form) — try opening `/careers` directly in a browser once deployed. Inside the CRM, open **Job Openings** and look for the "Copy Link" button per row, and the new "Confidential Client" checkbox in the Add/Edit form.
- *In the code:* `src/routes/careers.tsx` and `src/routes/careers.$jobId.tsx` (the public pages), `src/lib/careers.functions.ts` (apply logic + duplicate detection), `src/components/CareersLinkButton.tsx` (the copy-link button), `src/components/CrudModule.tsx` (a new reusable boolean/checkbox field type, used for the confidentiality toggle).
- *In Supabase:* `job_openings` table gained one column, `is_confidential`. Migration: `supabase/migrations/20260930080000_careers_page.sql`.

**Purpose:** a shareable, self-service way for candidates to apply to your open roles, with zero manual data entry on your end.

---

## Quick reference: every file changed, by step

| Step | New files | Modified files |
|---|---|---|
| 1. Reminders | `supabase/migrations/20260929060000_reminder_automation.sql` | `src/routes/_app.notifications.tsx` |
| 2. Email | `supabase/migrations/20260929070000_email_log.sql`, `src/lib/email.server.ts`, `src/lib/email.functions.ts`, `src/components/EmailComposeDialog.tsx` | `src/components/CrudModule.tsx`, `src/routes/_app.candidates.tsx`, `src/routes/_app.clients.tsx` |
| 3. Scheduling | `supabase/migrations/20260930050000_interview_scheduling_links.sql`, `src/lib/scheduling.ts`, `src/lib/scheduling.functions.ts`, `src/components/ScheduleLinkButton.tsx`, `src/routes/schedule.$token.tsx` | `src/routes/_app.interviews.tsx` |
| 4. Export/Reports | `src/lib/csv.ts`, `src/routes/_app.reports.tsx` | `src/components/CrudModule.tsx`, `src/components/AppSidebar.tsx` |
| 5. Workflow Rules | `supabase/migrations/20260930060000_workflow_rules.sql`, `src/routes/_app.workflow-rules.tsx` | `src/components/AppSidebar.tsx` |
| 6. Careers Page | `supabase/migrations/20260930080000_careers_page.sql`, `src/lib/careers.functions.ts`, `src/routes/careers.tsx`, `src/routes/careers.$jobId.tsx`, `src/components/CareersLinkButton.tsx` | `src/components/CrudModule.tsx`, `src/routes/_app.jobs.tsx` |

`src/integrations/supabase/types.ts` and `src/routeTree.gen.ts` were regenerated after every step that touched the database schema or added a new route — they're auto-generated, not hand-written, but they do need to be committed alongside everything else for the app to build.

Every migration listed above needs to be run against your Supabase database (SQL Editor, in order by filename/date) if you haven't already — the corresponding app feature will error until its migration has been applied.