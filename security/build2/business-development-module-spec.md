# Business Development & Outreach — Product/Engineering Specification v1.0
Date: 2026-11-09 | Status: design proposal only | Branch: security/build2-rls-ai-design-20261109
Scope: recruitment client acquisition, partnership development, and future CRM software sales. No production change authorized. No paid staging.

## 1. Goals and non-goals
Goals: enable one owner, next action, relationship history and clear opportunity stage for every qualified prospect; share a single organization/contact directory across three opportunity types; connect converted recruitment prospects to existing clients without overwriting recruitment records. Low-cost starter-business usability, responsive design and incremental delivery.
Non-goals for MVP: bulk unsolicited email, email scraping, autonomous sends, automated customer provisioning, subscriptions, predictive lead scores, third-party enrichment, public tenant signup or data migration.
Observed baseline: AppSidebar has recruitment-focused routes; clients has company_name/contact_person/phone/email/agreement_type/billing_model/status; profiles and user_roles support admin/recruiter/operations/finance/viewer; existing email_log and candidate_activities are not generic BD history. Source: src/components/AppSidebar.tsx; src/routes/_app.clients.tsx; src/hooks/use-auth.tsx; src/integrations/supabase/types.ts. Live security audit has 15 unconditional public-targeted ALL RLS policies and privileged views/functions. Security correction is prerequisite for any production BD data.

## 2. User journeys
Recruitment: research organization -> add organization and contact -> qualify recruitment opportunity -> manual approved outreach -> follow-up/meeting -> proposal -> won -> link/create existing clients record (explicit confirmation) -> job opening managed in existing module.
Partnership: add organization/contact -> opportunity type partnership with partner category (referral, channel, strategic, educational, technology, other) -> record meeting and proposed terms -> agree/reject -> relationship review date and referral tracking (later).
Software: add organization/contact -> software opportunity -> discovery -> demo -> trial/proposal -> won/lost -> handoff to future SaaS onboarding; NO automatic provisioning in MVP.
Multiple opportunities per organization allowed; one contact can be associated with multiple opportunities; no duplicate organization created for each opportunity.

## 3. Proposed data schema (all names provisional; no SQL executed)
bd_organizations: id uuid PK; tenant_id uuid NOT NULL (future SaaS isolation design); name text NOT NULL; normalized_name text; website text nullable; industry text; city text; country text; company_size_band text; source text; status text (prospect,active,inactive); owner_user_id uuid; created_by uuid; created_at timestamptz; updated_at timestamptz; archived_at timestamptz nullable. Unique scoped normalized_name/website rules require collision review, not blanket unique on name.
bd_contacts: id uuid PK; tenant_id; organization_id FK; full_name text NOT NULL; job_title text; work_email text nullable; work_phone text nullable; preferred_channel text; contact_source text; consent_status text (unknown,opt_in,opt_out); do_not_contact boolean default false; last_verified_at timestamptz; owner_user_id; created_at; updated_at; archived_at. Deduplicate on normalized work_email within tenant where present; review before merge. Never collect unnecessary sensitive data.
bd_opportunities: id uuid PK; tenant_id; organization_id FK; primary_contact_id FK nullable; type text CHECK recruitment_services/partnership/crm_software; title text NOT NULL; stage text; status text CHECK open/won/lost/on_hold; owner_user_id uuid NOT NULL; estimated_value numeric nullable; currency char(3) nullable; expected_close_date date nullable; next_action text nullable; next_action_due_at timestamptz nullable; source text; loss_reason text nullable; created_at; updated_at; closed_at. Validate stage per opportunity type in app and DB; no mandatory monetary value for partnership.
bd_opportunity_contacts: tenant_id; opportunity_id; contact_id; relationship_role; composite PK opportunity_id/contact_id; cross-tenant FKs enforced.
bd_activities: id; tenant_id; organization_id; opportunity_id nullable; contact_id nullable; type (call,email,meeting,linkedin,whatsapp,note,other); direction (outbound,inbound,internal); outcome; summary text; occurred_at; created_by; created_at; attachment_reference nullable; immutable audit metadata. Distinguish planned actions from actual sent events.
bd_tasks: id; tenant_id; organization_id; opportunity_id nullable; contact_id nullable; assignee_user_id; title; due_at; priority; status (open,done,cancelled); completed_at; created_by; created_at; updated_at. Overdue calculated from due_at and status.
bd_outreach_drafts: id; tenant_id; opportunity_id; contact_id; channel; subject nullable; body; status (draft,review_requested,approved,discarded); created_by; approved_by nullable; approved_at nullable; created_at; updated_at. No send function in MVP. Opt-out checked before copy/send. If future send added: approval, provider logs, suppression, per-tenant rate limit and delivery events.
bd_client_links: tenant_id; organization_id; client_id FK to existing clients; created_by; created_at; unique tenant_id/organization_id/client_id. Transitional link only; do not assume existing clients has tenant_id. Migration strategy must avoid exposing other tenants and requires schema reconciliation.
bd_partnership_details: opportunity_id PK/FK; tenant_id; category; proposed_terms_summary; agreement_status; review_date; referral_notes; no unapproved legal template claims.
bd_software_sales_details: opportunity_id PK/FK; tenant_id; demo_date; trial_status; proposed_plan_label; handoff_status; no provisioning or billing assumptions.
Optional later: bd_tags, bd_opportunity_stage_history, bd_templates, bd_documents, bd_referrals, bd_products/plans, bd_outreach_events.
Tenant_id must reference a validated tenant membership design. Current CRM has no verified multi-tenant implementation. DO NOT implement tenant_id in isolation or use client-supplied tenant IDs as authority. Enforce FK tenant consistency via composite constraints or validated functions. Consider tenant-scoped indexes (tenant_id,owner_user_id,status,updated_at), (tenant_id,organization_id), (tenant_id,due_at,status). Soft archive rather than destructive deletion in UI, with retention/deletion policy.

## 4. Screens, route proposals and acceptance criteria
/bd/dashboard: cards for open opportunities, due/overdue tasks, meetings, won/lost, type-specific funnel; owner/date filters; empty states.
/bd/organizations: searchable table; filters owner/industry/source/status; add/edit; dedupe warning; organization detail with contacts, opportunities, activities, tasks and link to existing recruitment client.
/bd/contacts: searchable directory, company association, contact details, consent/suppression, last contact, owner; no bulk export for unauthorized roles.
/bd/opportunities: list + accessible kanban grouped by type/stage; owner and date filters; type-specific required fields; next-action required for open qualified opportunities; drag/drop must enforce backend authorization and preserve stage history.
/bd/opportunities/$id: timeline, contacts, tasks, outreach drafts, proposal notes, win/loss reason; conversion handoff with confirmation.
/bd/outreach: human-reviewed draft composer, templates with variables, per-contact suppression warning, copy action and manual sent-event logging; no automatic send.
/bd/tasks: My Tasks, team tasks (authorized), overdue, upcoming; completion timestamp; reminders without email sending.
/bd/partnerships: filter partnership opportunities and category/review dates; agreement metadata only.
/bd/reports: type/owner/stage conversion, aging, first-response latency where recorded, due-task compliance, meetings, win/loss, CSV export with authorization.
Navigation: Business Development section above Recruitment; role-filtered menu plus server authorization; no existing route overwritten.
Mobile: table-to-card responsive behavior, large touch targets, keyboard-accessible stages, predictable loading/error/empty states.

## 5. Workflows and stage rules
Shared lead qualification: identified -> qualified -> contact_planned -> contacted -> engaged -> meeting -> proposal -> won/lost/nurture. Type-specific variants:
Recruitment: identified,qualified,contacted,discovery,proposal,negotiation,won/lost/nurture.
Partnership: identified,qualified,contacted,discussion,terms_review,agreed/lost/nurture.
Software: identified,qualified,contacted,discovery,demo,trial_or_proposal,negotiation,won/lost/nurture.
Persist canonical stage codes and label mappings. Enforce allowed transitions; stage history immutable with actor/time. Winning recruitment opportunity offers explicit link/create client with duplicate detection and audit; no automatic destructive synchronization. Winning partnership triggers review task; software win triggers manual handoff task, not subscription provisioning.
Activity capture: draft != sent; only mark sent after human action and evidence; record channel, timestamp, outcome. Follow-up suggestions never imply message was delivered. Reopen and loss reason supported.
Data import: CSV dry-run preview, mapping, dedupe and explicit confirmation; synthetic tests first. Never import real contact data until CEO authorizes access.

## 6. Authorization matrix (proposed, separate from existing recruitment role meanings)
Admin: read/write all BD within authorized tenant; approve outbound drafts; cannot bypass tenant or audit rules.
BD Manager (new scoped permission, not yet a CRM role): read BD team, assign owner, approve drafts, export permitted BD records.
BD Contributor (new scoped permission): create organization/contact/opportunity; read/write assigned BD records; tasks assigned to them; draft outreach; no approvals/bulk export by default.
Recruiter: recruitment opportunity access only when specifically assigned or BD Contributor permission granted; no automatic access to all BD records.
Operations: no BD contact access by default; assigned handoff tasks with minimal fields only.
Finance: aggregate permitted deal values or approved won-opportunity handoff only; no personal contacts or outreach bodies by default.
Viewer: no BD access by default.
Inactive/pending/suspended: deny all.
Implementation: keep existing app_role enum unchanged initially; use scoped bd_permissions and memberships after security design. Authorize every request on server with trusted membership and record ownership, independent of UI. Deny anon and cross-tenant reads/writes. Field projections prevent unnecessary personal information exposure. Never use service_role for user-facing BD queries. Approval for sending separate from draft approval and external integration access.

## 7. Security, privacy and compliance requirements
Release blocker: remove broad permissive ALL policies and redesign privileged views/functions after independent review; verify effective RLS with anon, pending, inactive, BD contributor own/other, BD manager, recruiter, operations, finance, viewer, admin, cross-tenant synthetic accounts. Test SELECT, INSERT, UPDATE USING/WITH CHECK, DELETE, view, RPC, storage, CSV and AI access. Default deny for unknown roles/tenant. Server rate limits, input validation, output encoding, CSRF/session protections as appropriate, secrets isolation, encryption in transit, audit of exports/permission changes, retention and backup/restore drills.
Contact provenance and lawful basis: record source and outreach preferences, respect opt-out and applicable email/telemarketing/privacy law; no scraped personal data imports or bulk messages by default. Document storage permissions tenant-scoped. Avoid storing third-party confidential material in AI prompts without consent/approval.
SaaS future: tenant-aware billing and metering, isolation, data portability, account deletion and incident response. No unsupported certification or 'most secure' claims.

## 8. Phased implementation plan and exit gates (estimates, not promises)
Phase 0, 1–2 weeks design effort: confirm field/stage definitions, current schema compatibility, owner roles, threat model, offline policy and permission tests; no production mutation. Exit: signed spec, reviewed access matrix, baseline synthetic tests.
Phase 1, 2–3 weeks: on development branch only, implement mock-data responsive screens, organization/contact/opportunity types, accessible stage flow and local unit tests. Exit: demo works with synthetic data; no real CRM connection.
Phase 2, 2–4 weeks: create proposed reversible migrations, server authorization and RLS policy code in branch; negative tests and integration test harness. Without approved isolated environment, mark DB behavior UNVERIFIED; do not deploy or run live SQL.
Phase 3, 1–2 weeks: outreach drafts, tasks, approvals, conversion handoff, reports and CSV authorization tests with synthetic data.
Phase 4, 2–3 weeks: isolated environment verification (requires separate CEO approval and cost approval if nonzero), security regression, UX pilot, backup/restore and migration reconciliation. Production rollout only after explicit CEO approval.
Parallel Build 2 security remediation remains gating dependency. Estimates assume one experienced engineer with normal review; may change after technical discovery.

## 9. Definition of done and measurable KPIs
Product: add organization/contact/opportunity in <=2 minutes for typical workflow; every qualified open opportunity has owner and next action; no duplicate client created by conversion; overdue tasks clearly visible; all screens usable on mobile; CSV export respects role and filters.
Security: 100% of synthetic negative cross-tenant/role cases denied; 0 broad public-targeted unconditional ALL policies in target environment; 0 unauthorized view/RPC access; audit events on ownership/approval/export; no unapproved outbound sends; restore drill documented.
Business metrics: new qualified opportunities/week; outreach-to-reply rate (only sent events actually logged); meeting conversion; opportunity win rate by type; median days to first follow-up; overdue task percentage; partner-sourced introductions; software demos and trial-to-win conversion. Establish baselines before targets.
Testing: unit tests for stage transitions, normalization, dedupe, task due dates and field allowlists; integration tests for FK tenant consistency and RLS; end-to-end journeys on synthetic fixtures; accessibility and error-state checks. Never equate unit passes with production safety.

## 10. Open design decisions
Confirm owner model (single owner + optional collaborators); opportunity stage customization per tenant vs fixed MVP; partnership categories; software plans not yet defined; contact provenance and lawful basis rules; data retention; exact conversion linking with existing clients; whether separate BD Manager/Contributor permissions are desired; which modules are visible to external SaaS tenants. Default recommendations above pending CEO review.

## 11. Constraints and evidence
GitHub main source reviewed 2026-11-09: AppSidebar, clients/jobs/users/app routes, types, package; Build 2 live read-only policy metadata audit documented in Drive blueprint. No candidate/customer rows accessed for this design. All schema, UI and workflows here are proposals, not deployed capabilities. No paid Supabase branch, SQL, production config, merge, or deployment.
