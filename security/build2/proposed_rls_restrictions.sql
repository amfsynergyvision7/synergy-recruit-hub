-- BUILD 2 PROPOSAL ONLY: DO NOT RUN ON LIVE/PRODUCTION.
-- Staging-only candidate; NOT a complete or approved production migration.
-- Must review all 15 affected tables and app dependencies before execution.
-- The current broad PUBLIC ALL policy bypasses narrower PERMISSIVE policies.
-- This script is deliberately conservative: it removes only the broad policy
-- in a controlled staging environment. It does not claim existing narrow
-- policies are adequate for the final role/record/field design.
-- REQUIREMENTS before staging use:
-- (1) full pg_policies/grants snapshot and rollback SQL;
-- (2) all expected read/write paths and trigger functions documented;
-- (3) synthetic staging data and isolated credentials;
-- (4) no direct production connection.
BEGIN;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.billing;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.candidate_activities;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.candidates;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.clients;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.google_integrations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.integrations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.interviews;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.job_openings;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.offers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.submissions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.user_roles;
COMMIT;
-- IMPORTANT: Existing narrower policies often use is_approved(auth.uid())
-- rather than assignment predicates. They MUST be redesigned before
-- claiming role-based row isolation. PostgreSQL RLS does NOT filter columns.
-- Explicitly review function EXECUTE, view SELECT grants and SECURITY INVOKER.
-- Revoke unauthorized grants only after verifying application dependencies.
-- Do not rename this file into an active supabase/migrations path until approved.
