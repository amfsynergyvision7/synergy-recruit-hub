-- Build159 isolated PG17 only: full trusted journal interface.
\set ON_ERROR_STOP on
BEGIN;
DO $gate$
BEGIN
 IF current_database() <> 'amf_build158_email_lab' THEN
  RAISE EXCEPTION 'BUILD159 STOP: non-disposable database';
 END IF;
END
$gate$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TYPE public.user_status AS ENUM ('pending','approved','suspended','rejected');
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','operations','finance','viewer');
CREATE TABLE public.profiles(id uuid PRIMARY KEY,status public.user_status NOT NULL,is_active boolean NOT NULL);
CREATE TABLE public.user_roles(id uuid PRIMARY KEY,user_id uuid NOT NULL,role public.app_role NOT NULL);
CREATE TABLE public.candidates(id uuid PRIMARY KEY,email text,assigned_recruiter uuid);
CREATE TABLE public.clients(id uuid PRIMARY KEY,email text);
CREATE TABLE public.email_log(
 id uuid PRIMARY KEY,related_table text NOT NULL,related_id uuid NOT NULL,
 to_email text NOT NULL,subject text NOT NULL,body text NOT NULL,
 status text NOT NULL,error text,provider_id text,sent_by uuid
);
CREATE TABLE public.audit_logs(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 user_id uuid,user_email text,action text NOT NULL,table_name text,
 record_id text,details jsonb,created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.profiles,public.user_roles,public.candidates,public.clients TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.email_log TO service_role;
GRANT SELECT,INSERT ON public.audit_logs TO service_role;
-- Simulate the new RLS: browser authenticated gets no direct email INSERT/UPDATE.
GRANT SELECT ON public.email_log TO authenticated;
\ir ../build158-email-outbox/pending-uniqueness.DO-NOT-APPLY.sql.txt
\ir trusted-journal-rpcs.DO-NOT-APPLY.sql.txt
\ir ../build160-email-reconciliation/reconcile-confirm-sent.DO-NOT-APPLY.sql.txt

-- Recreate ONLY in disposable PG17 the unsafe audit grant/policy combination
-- observed in production metadata, then apply source-identical review SQL.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.audit_logs
 AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "insert audit" ON public.audit_logs
 FOR INSERT TO authenticated WITH CHECK (true);
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON public.audit_logs TO anon,authenticated;
-- Simulate elevated service-role mutations before enforcing append-only.
GRANT UPDATE,DELETE,TRUNCATE ON public.audit_logs TO service_role;
DO $before$
BEGIN
 IF NOT has_table_privilege('anon','public.audit_logs','INSERT')
 OR NOT has_table_privilege('authenticated','public.audit_logs','DELETE')
 THEN RAISE EXCEPTION 'BUILD160 FAIL: unsafe audit fixture incomplete'; END IF;
END
$before$;
\ir ../build160-email-reconciliation/audit-log-lockdown.DO-NOT-APPLY.sql.txt
DO $after$
BEGIN
 IF has_table_privilege('anon','public.audit_logs','SELECT')
 OR has_table_privilege('anon','public.audit_logs','INSERT')
 OR has_table_privilege('anon','public.audit_logs','UPDATE')
 OR has_table_privilege('anon','public.audit_logs','DELETE')
 OR has_table_privilege('authenticated','public.audit_logs','INSERT')
 OR has_table_privilege('authenticated','public.audit_logs','UPDATE')
 OR has_table_privilege('authenticated','public.audit_logs','DELETE')
 OR NOT has_table_privilege('service_role','public.audit_logs','INSERT')
 OR has_table_privilege('service_role','public.audit_logs','UPDATE')
 OR has_table_privilege('service_role','public.audit_logs','DELETE')
 OR has_table_privilege('service_role','public.audit_logs','TRUNCATE')
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policies
   WHERE tablename='audit_logs' AND policyname='Allow all for authenticated')
 THEN RAISE EXCEPTION 'BUILD160 FAIL: audit lockdown not enforced'; END IF;
END
$after$;

INSERT INTO public.profiles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','approved',true),
 ('99999999-9999-4999-8999-999999999999','suspended',false);
INSERT INTO public.user_roles VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','recruiter'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','viewer'),
 ('44444444-4444-4444-8444-444444444444','99999999-9999-4999-8999-999999999999','recruiter');
INSERT INTO public.candidates VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','candidate@invalid.test','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','other@invalid.test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.clients VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','client@invalid.test');
-- Anonymous/authenticated cannot execute privileged RPCs even with known ids.
SET LOCAL ROLE authenticated;
DO $unauthorized$
DECLARE v_rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '55555555-5555-4555-8555-555555555555',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','clients',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'client@invalid.test','Test','Synthetic body');
 EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'BUILD159 FAIL: browser RPC callable'; END IF;
END
$unauthorized$;
RESET ROLE;
SET LOCAL ROLE service_role;
-- Actor-bound, record-bound reservation for assigned recruiter.
SELECT id,status FROM public.crm_email_reserve_trusted(
 '55555555-5555-4555-8555-555555555555',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'candidate@invalid.test','Synthetic test','No real correspondence');
-- Failed/unknown provider outcome: only the same pending id/actor can settle.
DO $security_tests$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_settle_trusted(
   '55555555-5555-4555-8555-555555555555',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sent','<provider@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: another actor settled';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_settle_trusted(
   '55555555-5555-4555-8555-555555555555',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sent','bad' || chr(10) || 'header');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: control character accepted';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'other@invalid.test','Blocked','Synthetic body');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: unrelated candidate allowed';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','clients',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'client@invalid.test','Blocked','Synthetic body');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: recruiter client access allowed';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','clients',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'client@invalid.test','Blocked','Synthetic body');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: viewer access allowed';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   '99999999-9999-4999-8999-999999999999','candidates',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'candidate@invalid.test','Blocked','Synthetic body');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: suspended user allowed';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'wrong@invalid.test','Blocked','Synthetic body');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: recipient substitution allowed';END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '55555555-5555-4555-8555-555555555555',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'candidate@invalid.test','Duplicate','Synthetic body');
 EXCEPTION WHEN unique_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: duplicate request UUID allowed';END IF;
 -- Different UUID must still respect pending same-record/recipient lock.
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '66666666-6666-4666-8666-666666666666',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'candidate@invalid.test','Conflict','Synthetic body');
 EXCEPTION WHEN unique_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: pending index bypass allowed';END IF;
END
$security_tests$;
-- Only same actor/attempt can finalize one pending journal row.
SELECT id,status FROM public.crm_email_settle_trusted(
 '55555555-5555-4555-8555-555555555555',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sent','<synthetic@invalid.test>');
-- A second settlement or replay cannot mutate a sent row.
DO $replay$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM public.crm_email_settle_trusted(
   '55555555-5555-4555-8555-555555555555',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','unknown',NULL);
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: replay changed sent row';END IF;
END
$replay$;
-- A new authorized, separately approved message may follow settled SENT.
SELECT id,status FROM public.crm_email_reserve_trusted(
 '77777777-7777-4777-8777-777777777777',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','candidates',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'candidate@invalid.test','New approved topic','Synthetic body');
SELECT id,status FROM public.crm_email_settle_trusted(
 '77777777-7777-4777-8777-777777777777',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','unknown',NULL);
-- Unconfirmed UNKNOWN must continue to block new reservations.
DO $unknown$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM public.crm_email_reserve_trusted(
   '88888888-8888-4888-8888-888888888888',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','candidates',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'candidate@invalid.test','Not allowed','Synthetic body');
 EXCEPTION WHEN unique_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD159 FAIL: unknown lock bypassed';END IF;
END
$unknown$;
RESET ROLE;
-- Restrict both RPCs: no PUBLIC/anon/authenticated EXECUTE.
DO $rights$
BEGIN
 IF has_function_privilege('anon',
  'public.crm_email_reserve_trusted(uuid,uuid,text,uuid,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.crm_email_reserve_trusted(uuid,uuid,text,uuid,text,text,text)','EXECUTE')
 OR has_function_privilege('anon',
  'public.crm_email_settle_trusted(uuid,uuid,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.crm_email_settle_trusted(uuid,uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.crm_email_reserve_trusted(uuid,uuid,text,uuid,text,text,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.crm_email_settle_trusted(uuid,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'BUILD159 FAIL: trusted function EXECUTE grants unsafe'; END IF;
END
$rights$;
-- Rehearsal SQL and synthetic data disappear completely.
-- Build160 isolated-only independent administrator, no real delivery.
INSERT INTO public.profiles VALUES
 ('12121212-1212-4212-8212-121212121212','approved',true);
INSERT INTO public.user_roles VALUES
 ('98989898-9898-4898-8898-989898989898',
  '12121212-1212-4212-8212-121212121212','admin');
CREATE FUNCTION public.build160_synthetic_audit_fail() RETURNS trigger
 LANGUAGE plpgsql AS $auditfailure$
BEGIN
 IF NEW.details->>'case_reference'='CASE-FAIL-0001' THEN
  RAISE EXCEPTION 'BUILD160 synthetic audit unavailable';
 END IF;
 RETURN NEW;
END
$auditfailure$;
CREATE TRIGGER build160_synthetic_audit_error BEFORE INSERT ON public.audit_logs
 FOR EACH ROW EXECUTE FUNCTION public.build160_synthetic_audit_fail();
SET LOCAL ROLE service_role;
-- The Build159 flow left attempt 7777 in UNKNOWN by admin actor AAAA.
DO $bad_access$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'CASE-2026-0001','<provider@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD160 FAIL: sender reconciled own message'; END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'CASE-2026-0001','<provider@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD160 FAIL: recruiter reconciled'; END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'CASE-2026-0001','<provider@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD160 FAIL: viewer reconciled'; END IF;
 denied:=false;
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   '12121212-1212-4212-8212-121212121212',
   'short','<provider@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD160 FAIL: invalid case accepted'; END IF;
END
$bad_access$;
-- Simulate audit trail outage: function must rollback the journal UPDATE.
DO $atomic$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   '12121212-1212-4212-8212-121212121212',
   'CASE-FAIL-0001','<provider-confirmed@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'BUILD160 FAIL: audit outage accepted'; END IF;
 IF (SELECT status FROM public.email_log
    WHERE id='77777777-7777-4777-8777-777777777777') <> 'unknown'
    OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
  RAISE EXCEPTION 'BUILD160 FAIL: audit failure did not rollback journal';
 END IF;
END
$atomic$;
SELECT id,status FROM public.crm_email_confirm_sent_trusted(
 '77777777-7777-4777-8777-777777777777',
 '12121212-1212-4212-8212-121212121212',
 'CASE-2026-0042','<provider-confirmed@invalid.test>');
DO $success$
DECLARE denied boolean:=false;
BEGIN
 IF (SELECT status FROM public.email_log
    WHERE id='77777777-7777-4777-8777-777777777777') <> 'sent'
 OR (SELECT count(*) FROM public.audit_logs
   WHERE action='crm_email_confirmed_sent'
    AND record_id='77777777-7777-4777-8777-777777777777')<>1
 OR (SELECT details->>'case_reference' FROM public.audit_logs
   WHERE record_id='77777777-7777-4777-8777-777777777777')<>'CASE-2026-0042'
 THEN RAISE EXCEPTION 'BUILD160 FAIL: atomic audit proof missing'; END IF;
 BEGIN
  PERFORM * FROM public.crm_email_confirm_sent_trusted(
   '77777777-7777-4777-8777-777777777777',
   '12121212-1212-4212-8212-121212121212',
   'CASE-2026-0042','<provider-confirmed@invalid.test>');
 EXCEPTION WHEN others THEN denied:=true;
 END;
 IF NOT denied OR (SELECT count(*) FROM public.audit_logs)<>1 THEN
  RAISE EXCEPTION 'BUILD160 FAIL: replay added duplicate audit';
 END IF;
END
$success$;
-- Build161: trusted service role is allowed to APPEND evidence but cannot
-- alter or erase a previously inserted audit record.
DO $append_only$
DECLARE denied_update boolean:=false;
 denied_delete boolean:=false;
 denied_truncate boolean:=false;
BEGIN
 BEGIN
  UPDATE public.audit_logs SET action='forged' WHERE true;
 EXCEPTION WHEN insufficient_privilege THEN denied_update:=true;
 END;
 BEGIN
  DELETE FROM public.audit_logs WHERE true;
 EXCEPTION WHEN insufficient_privilege THEN denied_delete:=true;
 END;
 BEGIN
  TRUNCATE public.audit_logs;
 EXCEPTION WHEN insufficient_privilege THEN denied_truncate:=true;
 END;
 IF NOT denied_update OR NOT denied_delete OR NOT denied_truncate
 THEN RAISE EXCEPTION 'BUILD161 FAIL: service role can mutate audit history'; END IF;
 IF (SELECT count(*) FROM public.audit_logs WHERE action='crm_email_confirmed_sent')<>1
 THEN RAISE EXCEPTION 'BUILD161 FAIL: append-only event was lost'; END IF;
END
$append_only$;
RESET ROLE;
-- Build162 disposable PG17 role verification. Synthetic RLS policy only.
-- This is not a production migration or proof of real hosted JWT semantics.
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=''
AS $u$ SELECT nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid $u$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION public.build162_is_admin_audit_reader(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $a$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.profiles p
 ON r.user_id=p.id WHERE r.user_id=p_actor AND r.role='admin'
 AND p.status='approved' AND p.is_active IS TRUE)
$a$;
REVOKE ALL ON FUNCTION public.build162_is_admin_audit_reader(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.build162_is_admin_audit_reader(uuid) TO authenticated;
CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated
USING (public.build162_is_admin_audit_reader(auth.uid()));
SET LOCAL ROLE anon;
DO $anonymous$
DECLARE command text; denied boolean;
BEGIN
 FOREACH command IN ARRAY ARRAY[
  'SELECT id FROM public.audit_logs LIMIT 1',
  'INSERT INTO public.audit_logs(action) VALUES (''forged'')',
  'UPDATE public.audit_logs SET action=''forged''',
  'DELETE FROM public.audit_logs',
  'TRUNCATE public.audit_logs'
 ] LOOP
  denied:=false;
  BEGIN EXECUTE command;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'BUILD162 FAIL: anonymous audit ACL allowed: %',command;END IF;
 END LOOP;
END $anonymous$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
DO $ordinary$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.audit_logs;
 IF n<>0 THEN RAISE EXCEPTION 'BUILD162 FAIL: non-admin audit reader sees rows';END IF;
END $ordinary$;
SET LOCAL request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $admin$
DECLARE n integer;command text;denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.audit_logs;
 IF n<>1 THEN RAISE EXCEPTION 'BUILD162 FAIL: approved admin cannot read audit metadata';END IF;
 FOREACH command IN ARRAY ARRAY[
  'INSERT INTO public.audit_logs(action) VALUES (''forged'')',
  'UPDATE public.audit_logs SET action=''forged''',
  'DELETE FROM public.audit_logs',
  'TRUNCATE public.audit_logs'
 ] LOOP
  denied:=false;
  BEGIN EXECUTE command;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'BUILD162 FAIL: authenticated audit mutation allowed: %',command;END IF;
 END LOOP;
END $admin$;
RESET ROLE;
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.audit_logs WHERE action='crm_email_confirmed_sent')<>1
 OR has_table_privilege('anon','public.audit_logs','TRUNCATE')
 OR has_table_privilege('authenticated','public.audit_logs','TRUNCATE')
 THEN RAISE EXCEPTION 'BUILD162 FAIL: append-only evidence or ACL unsafe';END IF;
END $final$;

DO $privileges$
BEGIN
 IF has_function_privilege('anon',
  'public.crm_email_confirm_sent_trusted(uuid,uuid,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.crm_email_confirm_sent_trusted(uuid,uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.crm_email_confirm_sent_trusted(uuid,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'BUILD160 FAIL: reconciliation privileges unsafe'; END IF;
END
$privileges$;
ROLLBACK;
