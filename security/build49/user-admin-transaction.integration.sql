-- BUILD49: Disposable synthetic PostgreSQL test of JWT-scoped admin approval.
-- This test uses SET LOCAL request.jwt.claim.sub, NOT actual hosted GoTrue sign-in.
-- Whole transaction ROLLBACK; no production/staging or persisted test records.
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $auth49$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $auth49$;
SET LOCAL statement_timeout='35s';
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected','suspended');
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TABLE public.profiles(
 id uuid PRIMARY KEY,full_name text NOT NULL,email text NOT NULL,
 status public.user_status NOT NULL,is_active boolean NOT NULL,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id uuid NOT NULL,role public.app_role NOT NULL,UNIQUE(user_id,role));
CREATE TABLE public.audit_logs(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id uuid,action text NOT NULL,table_name text,record_id text,details jsonb,
 created_at timestamptz DEFAULT now());
INSERT INTO public.profiles(id,full_name,email,status,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Admin A','a@example.invalid','approved',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Admin B','b@example.invalid','approved',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Recruiter C','c@example.invalid','approved',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Applicant D','d@example.invalid','pending',false),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Suspended Admin E','e@example.invalid','suspended',false);
INSERT INTO public.user_roles(user_id,role) VALUES
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','recruiter'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer'),('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','admin');
CREATE OR REPLACE FUNCTION public.crm_admin_manage_user(
  p_target uuid,
  p_operation text,
  p_value text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $manage$
DECLARE
  v_actor uuid := auth.uid();
  v_target_status public.user_status;
  v_target_active boolean;
  v_old_roles text[];
  v_new_roles text[];
  v_was_admin boolean;
  v_change_revokes_admin boolean;
  v_other_admins integer;
BEGIN
  IF v_actor IS NULL OR p_target IS NULL OR p_operation IS NULL
     OR p_value IS NULL OR length(p_value)>50 THEN
    RAISE EXCEPTION 'Invalid administration request' USING ERRCODE='22023';
  END IF;
  IF p_operation NOT IN ('set_status','set_active','set_role') THEN
    RAISE EXCEPTION 'Unsupported administration action' USING ERRCODE='22023';
  END IF;
  -- The verified JWT identity is the only acting principal. A client cannot
  -- supply p_actor; browser-callable authenticated role has no direct DML grants.
  IF NOT EXISTS(
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id=v_actor AND p.status='approved'
      AND p.is_active IS TRUE AND r.role='admin'
  ) THEN RAISE EXCEPTION 'Approved active administrator required' USING ERRCODE='42501'; END IF;
  -- Serialize administrative changes globally, so simultaneous demotions
  -- cannot independently pass the "last active administrator" check.
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_admin_role_and_status',0));
  IF p_target=v_actor THEN
    RAISE EXCEPTION 'Self administration is prohibited' USING ERRCODE='42501';
  END IF;
  SELECT p.status,p.is_active INTO v_target_status,v_target_active
  FROM public.profiles p WHERE p.id=p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE='P0002';
  END IF;
  SELECT coalesce(array_agg(r.role::text ORDER BY r.role::text),ARRAY[]::text[])
    INTO v_old_roles FROM public.user_roles r WHERE r.user_id=p_target;
  v_was_admin:=v_target_status='approved' AND v_target_active AND 'admin'=ANY(v_old_roles);
  IF p_operation='set_status' THEN
    IF p_value NOT IN ('pending','approved','rejected','suspended') THEN
      RAISE EXCEPTION 'Unsupported account status' USING ERRCODE='22023'; END IF;
    v_change_revokes_admin:=p_value<>'approved';
  ELSIF p_operation='set_active' THEN
    IF p_value NOT IN ('true','false') THEN
      RAISE EXCEPTION 'Activation must be true or false' USING ERRCODE='22023'; END IF;
    IF p_value='true' AND v_target_status<>'approved' THEN
      RAISE EXCEPTION 'Cannot activate a nonapproved account' USING ERRCODE='42501'; END IF;
    v_change_revokes_admin:=p_value='false';
  ELSE
    IF p_value NOT IN ('admin','recruiter','operations','finance','viewer') THEN
      RAISE EXCEPTION 'Unsupported account role' USING ERRCODE='22023'; END IF;
    v_change_revokes_admin:=p_value<>'admin';
  END IF;
  IF v_was_admin AND v_change_revokes_admin THEN
    SELECT count(DISTINCT p.id) INTO v_other_admins
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id=p.id
    WHERE p.id<>p_target AND p.status='approved'
      AND p.is_active IS TRUE AND r.role='admin';
    IF v_other_admins<1 THEN
      RAISE EXCEPTION 'Cannot revoke the last active administrator' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_operation='set_status' THEN
    UPDATE public.profiles p
       SET status=p_value::public.user_status,
           is_active=(p_value='approved'),
           updated_at=clock_timestamp()
     WHERE p.id=p_target;
  ELSIF p_operation='set_active' THEN
    UPDATE public.profiles p
       SET is_active=(p_value='true'),updated_at=clock_timestamp()
     WHERE p.id=p_target;
  ELSE
    -- Existing CRM UI models one effective role per account. Keep the
    -- replacement and audit in one transaction, unlike delete+insert in UI.
    DELETE FROM public.user_roles WHERE user_id=p_target;
    INSERT INTO public.user_roles(user_id,role)
    VALUES(p_target,p_value::public.app_role);
  END IF;
  SELECT coalesce(array_agg(r.role::text ORDER BY r.role::text),ARRAY[]::text[])
    INTO v_new_roles FROM public.user_roles r WHERE r.user_id=p_target;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,'crm_admin_'||p_operation,
    CASE WHEN p_operation='set_role' THEN 'user_roles' ELSE 'profiles' END,
    p_target::text,
    jsonb_build_object('operation',p_operation,'new_value',p_value,
      'old_status',v_target_status::text,
      'old_active',v_target_active,
      'old_roles',v_old_roles,'new_roles',v_new_roles));
  -- An audit INSERT failure aborts the entire profile/role change.
  RETURN true;
END $manage$;
REVOKE ALL ON FUNCTION public.crm_admin_manage_user(uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_manage_user(uuid,text,text)
 TO authenticated;
CREATE FUNCTION public.build49_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $audit$
BEGIN
 IF current_setting('build49.fail_audit',true)='on'
 THEN RAISE EXCEPTION 'synthetic audit write rejected' USING ERRCODE='P9001'; END IF;
 RETURN NEW;
END $audit$;
CREATE TRIGGER build49_fail_audit BEFORE INSERT ON public.audit_logs
 FOR EACH ROW EXECUTE FUNCTION public.build49_fail_audit();
DO $all$ DECLARE n integer; old_roles text[]; BEGIN
 IF has_function_privilege('anon','public.crm_admin_manage_user(uuid,text,text)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_admin_manage_user(uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_admin_manage_user(uuid,text,text)','EXECUTE') THEN
 RAISE EXCEPTION 'RPC execution grants incorrect'; END IF;
 -- Only approved ACTIVE admin identity is accepted. These claims are synthetic.
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_status','approved');
 RAISE EXCEPTION 'recruiter elevated to admin'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_status','approved');
 RAISE EXCEPTION 'suspended admin could approve'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 BEGIN PERFORM public.crm_admin_manage_user('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','set_active','false');
 RAISE EXCEPTION 'self deactivation permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','DELETE_ALL','admin');
 RAISE EXCEPTION 'unsupported operation allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_role','superadmin');
 RAISE EXCEPTION 'unsupported role allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_active','true');
 RAISE EXCEPTION 'pending account activated'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.crm_admin_manage_user('ffffffff-ffff-4fff-8fff-ffffffffffff','set_status','approved');
 RAISE EXCEPTION 'unknown target allowed'; EXCEPTION WHEN no_data_found THEN NULL; END;
 IF NOT public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_status','approved')
 THEN RAISE EXCEPTION 'approve action returned false'; END IF;
 IF (SELECT status FROM public.profiles WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'approved'
 OR NOT (SELECT is_active FROM public.profiles WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
 THEN RAISE EXCEPTION 'approve action did not mutate target'; END IF;
 IF NOT public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_role','recruiter')
 THEN RAISE EXCEPTION 'role action returned false'; END IF;
 IF (SELECT count(*) FROM public.user_roles WHERE user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND role='recruiter')
 THEN RAISE EXCEPTION 'atomic role replacement incomplete'; END IF;
 IF NOT public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_active','false')
 THEN RAISE EXCEPTION 'deactivation failed'; END IF;
 IF (SELECT is_active FROM public.profiles WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
 THEN RAISE EXCEPTION 'account not deactivated'; END IF;
 IF (SELECT count(*) FROM public.audit_logs)<>3 THEN RAISE EXCEPTION 'admin writes were not audited'; END IF;
 -- Introduce an audit log error after the role write, confirm all work rolls back.
 PERFORM set_config('build49.fail_audit','on',true);
 BEGIN PERFORM public.crm_admin_manage_user('dddddddd-dddd-4ddd-8ddd-dddddddddddd','set_role','finance');
 RAISE EXCEPTION 'audit failure not injected'; EXCEPTION WHEN SQLSTATE 'P9001' THEN NULL; END;
 PERFORM set_config('build49.fail_audit','off',true);
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND role='finance')
 OR (SELECT count(*) FROM public.audit_logs)<>3 THEN
 RAISE EXCEPTION 'privileged admin mutation persisted despite audit failure'; END IF;
 -- Existing second administrator may be demoted while one active admin remains.
 PERFORM public.crm_admin_manage_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','set_role','recruiter');
 IF (SELECT count(*) FROM public.profiles p
 JOIN public.user_roles r ON r.user_id=p.id
 WHERE p.status='approved' AND p.is_active AND r.role='admin')<>1
 THEN RAISE EXCEPTION 'unexpected active admin count'; END IF;
 BEGIN PERFORM public.crm_admin_manage_user('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','set_role','viewer');
 RAISE EXCEPTION 'last active admin self lockout allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- No synthetic user is an actual hosted Auth test account.
 SELECT count(*) INTO n FROM public.audit_logs;
 IF n<>4 THEN RAISE EXCEPTION 'expected 4 auditable actions, got %',n; END IF;
END $all$;
ROLLBACK;
SELECT 'PASS Build49 atomic role/status management with synthetic JWT subject, audit rollback and role protections' AS outcome,
 NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='public' AND c.relname='profiles') AS no_profiles_left;
