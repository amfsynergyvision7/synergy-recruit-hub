-- Build177 DISPOSABLE POSTGRESQL17 TEST ONLY / isolated CI container.
-- NEVER point psql at any hosted database; no secrets or database URLs.
-- All fictional roles / table objects are created inside ONE transaction and rolled back.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action_name text);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.audit_logs TO PUBLIC,anon,authenticated,service_role;
CREATE POLICY "Allow all for authenticated" ON public.audit_logs FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated USING (false);
DO $check$
BEGIN
 IF NOT has_table_privilege('anon','public.audit_logs','TRUNCATE') OR
 NOT has_table_privilege('authenticated','public.audit_logs','MAINTAIN') OR
 NOT has_table_privilege('service_role','public.audit_logs','UPDATE') THEN
 RAISE EXCEPTION 'Build177 disposable unsafe baseline not reproduced';
 END IF;
END
$check$;
\i security/build177-audit-main/reviewed/lockdown.DO-NOT-APPLY.sql.txt
DO $check$
DECLARE who text; pr text; p integer;
BEGIN
 FOR who IN SELECT unnest(ARRAY['anon','authenticated','service_role']) LOOP
  FOREACH pr IN ARRAY ARRAY['REFERENCES','TRIGGER','MAINTAIN'] LOOP
   IF has_table_privilege(who,'public.audit_logs',pr) THEN
    RAISE EXCEPTION 'Build177 retained dangerous privilege % for %',pr,who;
   END IF;
  END LOOP;
 END LOOP;
 IF has_table_privilege('anon','public.audit_logs','SELECT') OR
    has_table_privilege('anon','public.audit_logs','INSERT') OR
    has_table_privilege('anon','public.audit_logs','UPDATE') OR
    has_table_privilege('anon','public.audit_logs','DELETE') OR
    has_table_privilege('anon','public.audit_logs','TRUNCATE') THEN
  RAISE EXCEPTION 'Build177 anon should have zero table access';
 END IF;
 IF NOT has_table_privilege('authenticated','public.audit_logs','SELECT') OR
    has_table_privilege('authenticated','public.audit_logs','INSERT') OR
    has_table_privilege('authenticated','public.audit_logs','UPDATE') OR
    has_table_privilege('authenticated','public.audit_logs','DELETE') OR
    has_table_privilege('authenticated','public.audit_logs','TRUNCATE') THEN
  RAISE EXCEPTION 'Build177 authenticated should be select-only';
 END IF;
 IF NOT has_table_privilege('service_role','public.audit_logs','INSERT') OR
    has_table_privilege('service_role','public.audit_logs','UPDATE') OR
    has_table_privilege('service_role','public.audit_logs','DELETE') OR
    has_table_privilege('service_role','public.audit_logs','TRUNCATE') THEN
  RAISE EXCEPTION 'Build177 service role should be append-only';
 END IF;
 SELECT count(*) INTO p FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs';
 IF p<>1 THEN RAISE EXCEPTION 'Build177 unexpected residual audit policies %',p; END IF;
 RAISE NOTICE 'Build177 disposable grant rehearsal PASS; transaction will ROLLBACK';
END
$check$;
ROLLBACK;
DO $check$
BEGIN
 IF to_regclass('public.audit_logs') IS NOT NULL OR
 EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) THEN
  RAISE EXCEPTION 'Build177 disposable rollback failed';
 END IF;
 RAISE NOTICE 'Build177 disposable roles/table rollback verified';
END
$check$;
