-- Build79 full 19-table synthetic-only POSTSEED aggregate verification.
-- READ ONLY; zero user identifiers, PII, passwords, tokens or row data returned.
-- Run ONLY on isolated nonproduction after approved GoTrue, 8/8/2 and 16-table seeds.
WITH per_table AS (
SELECT 'app_settings'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.app_settings
 UNION ALL
SELECT 'audit_logs'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.audit_logs
 UNION ALL
SELECT 'billing'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.billing
 UNION ALL
SELECT 'candidate_activities'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.candidate_activities
 UNION ALL
SELECT 'candidate_stage_history'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.candidate_stage_history
 UNION ALL
SELECT 'candidates'::text AS table_name, 2::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.candidates
 UNION ALL
SELECT 'clients'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.clients
 UNION ALL
SELECT 'email_log'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.email_log
 UNION ALL
SELECT 'google_integrations'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.google_integrations
 UNION ALL
SELECT 'integrations'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.integrations
 UNION ALL
SELECT 'interviews'::text AS table_name, 2::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.interviews
 UNION ALL
SELECT 'job_openings'::text AS table_name, 2::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.job_openings
 UNION ALL
SELECT 'notifications'::text AS table_name, 2::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.notifications
 UNION ALL
SELECT 'offers'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.offers
 UNION ALL
SELECT 'profiles'::text AS table_name, 8::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.profiles
 UNION ALL
SELECT 'submissions'::text AS table_name, 2::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.submissions
 UNION ALL
SELECT 'sync_logs'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.sync_logs
 UNION ALL
SELECT 'user_roles'::text AS table_name, 8::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.user_roles
 UNION ALL
SELECT 'workflow_rules'::text AS table_name, 1::bigint AS expected_count, count(*)::bigint AS actual_count FROM public.workflow_rules
),
role_groups(role_name,status_name,is_active,expected_count) AS (VALUES
 ('admin','approved',true,1),('recruiter','approved',true,2),
 ('recruiter','pending',true,1),('recruiter','approved',false,1),
 ('finance','approved',true,1),('operations','approved',true,1),
 ('viewer','approved',true,1)
), actual_roles AS (
 SELECT r.role::text role_name,p.status::text status_name,p.is_active,count(*)::bigint actual_count
 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
 GROUP BY 1,2,3
), compared_roles AS (
 SELECT e.role_name,e.status_name,e.is_active,e.expected_count,
  coalesce(a.actual_count,0) actual_count
 FROM role_groups e LEFT JOIN actual_roles a USING (role_name,status_name,is_active)
 UNION ALL
 SELECT a.role_name,a.status_name,a.is_active,0,a.actual_count
 FROM actual_roles a LEFT JOIN role_groups e USING (role_name,status_name,is_active)
 WHERE e.role_name IS NULL
), s AS (
 SELECT
  (SELECT count(*) FROM per_table) table_groups,
  (SELECT count(*) FROM per_table WHERE expected_count<>actual_count) mismatched_table_groups,
  (SELECT sum(actual_count) FROM per_table) total_application_rows,
  (SELECT count(*) FROM auth.users) auth_users,
  (SELECT count(*) FROM auth.users WHERE email ~* '^amf-uat-0[1-9]@example[.]invalid$') exact_synthetic_email_users,
  (SELECT count(DISTINCT email) FROM auth.users) distinct_auth_emails,
  (SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
      LEFT JOIN public.user_roles r ON r.user_id=u.id
      WHERE p.id IS NULL AND r.user_id IS NULL) unprofiled_and_unroled_auth_slots,
  (SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
      LEFT JOIN public.user_roles r ON r.user_id=u.id
      WHERE (p.id IS NULL)<>(r.user_id IS NULL)) partial_auth_slots,
  (SELECT count(*) FROM public.profiles p JOIN auth.users u ON u.id=p.id AND u.email=p.email) matching_auth_profiles,
  (SELECT count(*) FROM compared_roles WHERE actual_count<>expected_count) role_status_group_mismatches,
  (SELECT count(*) FROM public.candidates c JOIN public.profiles p ON p.id=c.assigned_recruiter
      JOIN public.user_roles ur ON ur.user_id=p.id
      WHERE c.id=c.assigned_recruiter AND p.status='approved' AND p.is_active
      AND ur.role='recruiter' AND c.stage='lead_received'
      AND c.created_source='build78_synthetic_lab') approved_recruiter_owned_candidates,
  (SELECT count(*) FROM public.google_integrations
      WHERE auto_sync_enabled=false AND sheet_url IS NULL AND spreadsheet_id IS NULL
        AND google_account_email IS NULL) inert_google_rows,
  (SELECT count(*) FROM public.integrations
      WHERE auto_sync=false AND sheet_url IS NULL AND spreadsheet_id IS NULL) inert_sheet_rows,
  (SELECT count(*) FROM public.workflow_rules WHERE is_active=false) inactive_rule_rows,
  (SELECT count(*) FROM public.email_log
      WHERE status='synthetic_never_sent' AND provider_id IS NULL
        AND to_email LIKE '%@example.invalid') inert_mail_rows,
  (SELECT count(*) FROM public.sync_logs WHERE status='never_run'
      AND rows_scanned=0 AND rows_created=0 AND rows_updated=0 AND rows_skipped=0) inert_sync_rows,
  (SELECT count(*) FROM public.billing
      WHERE invoice_number IS NULL AND invoice_date IS NULL AND
      invoice_amount=0 AND placement_fee=0 AND outstanding_amount=0 AND
      payment_status='synthetic_draft_never_issue') inert_finance_rows,
  (SELECT count(*) FROM public.offers
      WHERE offer_status='draft' AND joining_status='not_joined' AND
      joining_date IS NULL AND salary IS NULL AND ctc IS NULL) inert_offer_rows,
  (SELECT count(*) FROM public.notifications WHERE is_read=true
      AND type='synthetic_no_delivery') inert_notification_rows,
  (SELECT count(*) FROM public.app_settings WHERE resume_import_folder_url IS NULL
      AND updated_by IS NULL) inert_app_settings_rows,
  (SELECT count(*) FROM public.submissions s JOIN public.job_openings j ON j.id=s.job_id
      JOIN public.candidates c ON c.id=s.candidate_id
      WHERE j.assigned_recruiter=c.assigned_recruiter AND s.status='synthetic_hold') linked_submission_rows,
  (SELECT count(*) FROM public.interviews i JOIN public.submissions s ON s.id=i.submission_uuid
      WHERE i.candidate_id=s.candidate_id AND i.status='not_scheduled'
      AND i.interview_date IS NULL) linked_unscheduled_interviews,
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled<>'D') enabled_app_triggers,
  (SELECT count(*) FROM pg_publication_rel pr JOIN pg_class c ON c.oid=pr.prrelid
      WHERE c.relnamespace='public'::regnamespace) published_app_tables
)
SELECT *,
 CASE WHEN table_groups=19 AND mismatched_table_groups=0 AND total_application_rows=38
  AND auth_users=9 AND exact_synthetic_email_users=9 AND distinct_auth_emails=9
  AND unprofiled_and_unroled_auth_slots=1 AND partial_auth_slots=0
  AND matching_auth_profiles=8 AND role_status_group_mismatches=0
  AND approved_recruiter_owned_candidates=2 AND inert_google_rows=1
  AND inert_sheet_rows=1 AND inactive_rule_rows=1 AND inert_mail_rows=1
  AND inert_sync_rows=1 AND inert_finance_rows=1 AND inert_offer_rows=1
  AND inert_notification_rows=2 AND inert_app_settings_rows=1
  AND linked_submission_rows=2 AND linked_unscheduled_interviews=2
  AND enabled_app_triggers=0 AND published_app_tables=0
 THEN 'BUILD79_FULL_SYNTHETIC_POSTSEED_INTEGRITY_PASS_NOT_SIGNED_UAT'
 ELSE 'HOLD_BUILD79_FULL_SYNTHETIC_POSTSEED_INTEGRITY'
 END AS postseed_gate, 0::integer AS signed_uat_cases_accepted
FROM s;
