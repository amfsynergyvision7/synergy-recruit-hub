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
-- Synthetic admin-policy stub mirrors the source-pinned catalog expression,
-- but always denies rows. No user/auth data or real administrator is created.
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $ SELECT NULL::uuid $;
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean
 LANGUAGE sql STABLE AS $ SELECT false $;
CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated
 USING (has_role(auth.uid(), 'admin'::app_role));
DO $check$
BEGIN
 IF NOT has_table_privilege('anon','public.audit_logs','TRUNCATE') OR
 NOT has_table_privilege('authenticated','public.audit_logs','MAINTAIN') OR
 NOT has_table_privilege('service_role','public.audit_logs','UPDATE') THEN
 RAISE EXCEPTION 'Build177 disposable unsafe baseline not reproduced';
 END IF;
END
$check$;
-- Run the copied and otherwise UNCHANGED Build160 read-only release preflight.
-- The runner derives its query into a disposable local psql \gset file.
\i /tmp/build178-audit-preflight.gset.sql
SELECT (
 :audit_total_audit_policies::integer = 3 AND
 :audit_broadly_permissive_all::integer = 1 AND
 :audit_safe_rpc_count::integer = 0 AND
 :'audit_audit_integrity_gate' = 'HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT'
) AS original_gate_holds \gset
\if :original_gate_holds
  \echo 'Build178 pre-revocation source-pinned release gate correctly HOLDS'
\else
  \quit 2
\endif
\i security/build177-audit-main/reviewed/lockdown.DO-NOT-APPLY.sql.txt
-- Even if the mock grant reductions are correct, missing trusted RPC
-- guarantees the SAME authoritative source-pinned preflight still HOLDS.
\i /tmp/build178-audit-preflight.gset.sql
SELECT (
 :audit_total_audit_policies::integer = 1 AND
 :audit_broadly_permissive_all::integer = 0 AND
 :audit_admin_select_policies::integer = 1 AND
 :audit_safe_rpc_count::integer = 0 AND
 :'audit_audit_integrity_gate' = 'HOLD_AUDIT_LOG_READABLE_MUTABLE_OR_RECONCILIATION_RPC_ABSENT'
) AS post_lockdown_gate_holds \gset
\if :post_lockdown_gate_holds
  \echo 'Build178 post-revocation source-pinned release gate STILL HOLDS without trusted RPC'
\else
  \quit 2
\endif
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
 to_regnamespace('auth') IS NOT NULL OR to_regtype('public.app_role') IS NOT NULL OR
 EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) THEN
  RAISE EXCEPTION 'Build177 disposable rollback failed';
 END IF;
 RAISE NOTICE 'Build177 disposable roles/table rollback verified';
END
$check$;
