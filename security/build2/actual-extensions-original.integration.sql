-- Exact extension migration against a disposable Supabase PostgreSQL image ONLY.
-- This installs no extensions in any operational/staging database and makes no HTTP requests.
\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20260513101842_cb1bc9ab-e5f4-4b42-b09a-60588844ca6c.sql
DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_extension WHERE extname IN ('pg_cron','pg_net'))<>2 THEN
  RAISE EXCEPTION 'Original extension migration did not install both required extensions'; END IF;
 IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL THEN
  RAISE EXCEPTION 'Original extensions are missing cron/net schemas'; END IF;
END $verify$;
-- Both original statements are guarded by IF NOT EXISTS and should permit rerun.
\ir ../../supabase/migrations/20260513101842_cb1bc9ab-e5f4-4b42-b09a-60588844ca6c.sql
ROLLBACK;
SELECT 'PASS: original pg_cron and pg_net migration executed twice with synthetic transactional rollback' AS result;
