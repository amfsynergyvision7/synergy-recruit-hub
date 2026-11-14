-- BUILD49: Disposable synthetic PostgreSQL test of JWT-scoped admin approval.
-- This test uses SET LOCAL request.jwt.claim.sub, NOT actual hosted GoTrue sign-in.
-- Whole transaction ROLLBACK; no production/staging or persisted test records.
BEGIN;
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
ALTER TABLE public.profiles ADD COLUMN phone text,ADD COLUMN department text;
CREATE OR REPLACE FUNCTION public.crm_update_own_profile(
  p_full_name text,
  p_phone text,
  p_department text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $self$
DECLARE
  v_actor uuid := auth.uid();
  v_name text := nullif(btrim(p_full_name),'');
  v_phone text := nullif(btrim(p_phone),'');
  v_department text := nullif(btrim(p_department),'');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF v_name IS NULL OR length(v_name)>120
     OR length(coalesce(v_phone,''))>32
     OR length(coalesce(v_department,''))>120 THEN
    RAISE EXCEPTION 'Invalid self-profile fields' USING ERRCODE='22023';
  END IF;
  -- The caller does not provide a target ID, status, role or is_active value.
  -- Only the authenticated user's ordinary, non-privileged fields can change.
  UPDATE public.profiles p
     SET full_name=v_name,phone=v_phone,department=v_department,
         updated_at=clock_timestamp()
   WHERE p.id=v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Self profile not found' USING ERRCODE='P0002';
  END IF;
  -- Log the field names, not phone/name values. Audit failure rolls back edits.
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,details)
  VALUES(v_actor,'crm_self_profile_update','profiles',v_actor::text,
    jsonb_build_object('fields',jsonb_build_array('full_name','phone','department')));
  RETURN true;
END $self$;
REVOKE ALL ON FUNCTION public.crm_update_own_profile(text,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.crm_update_own_profile(text,text,text) TO authenticated;
CREATE FUNCTION public.build49_fail_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $fail$
BEGIN IF current_setting('build49.fail_profile_audit',true)='on'
 THEN RAISE EXCEPTION 'synthetic profile audit rejected' USING ERRCODE='P9001'; END IF;
 RETURN NEW;
END $fail$;
CREATE TRIGGER build49_fail_profile_audit BEFORE INSERT ON public.audit_logs
 FOR EACH ROW EXECUTE FUNCTION public.build49_fail_profile_audit();

DO $self_test$ DECLARE n integer; status_before text; BEGIN
 IF has_function_privilege('anon','public.crm_update_own_profile(text,text,text)','EXECUTE')
 OR has_function_privilege('service_role','public.crm_update_own_profile(text,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.crm_update_own_profile(text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Self profile RPC grant incorrect'; END IF;
 BEGIN PERFORM public.crm_update_own_profile('A','123','D');
  RAISE EXCEPTION 'JWT-less user edited profile'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 BEGIN PERFORM public.crm_update_own_profile('',null,null);
  RAISE EXCEPTION 'blank profile name accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.crm_update_own_profile(repeat('x',121),null,null);
  RAISE EXCEPTION 'overlong profile name accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF NOT public.crm_update_own_profile('Admin Alpha','+91 1234567890','Consulting')
 THEN RAISE EXCEPTION 'valid self edit failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
  AND p.full_name='Admin Alpha' AND p.phone='+91 1234567890'
  AND p.department='Consulting' AND p.status='approved' AND p.is_active IS TRUE)
 THEN RAISE EXCEPTION 'self edit mutated restricted fields or lost valid data'; END IF;
 IF (SELECT count(*) FROM public.user_roles r WHERE r.user_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' AND r.role='admin')<>1
 THEN RAISE EXCEPTION 'self edit modified role'; END IF;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 IF NOT public.crm_update_own_profile('Applicant D updated',null,null)
 THEN RAISE EXCEPTION 'pending account cannot update ordinary profile fields'; END IF;
 IF (SELECT status FROM public.profiles WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'pending'
 THEN RAISE EXCEPTION 'pending status escalated'; END IF;
 IF (SELECT full_name FROM public.profiles WHERE id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')<>'Admin Alpha'
 THEN RAISE EXCEPTION 'self profile edit reached another user'; END IF;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 CREATE TEMP TABLE IF NOT EXISTS build49_test_audit_failure(noop integer);
 PERFORM set_config('build49.fail_profile_audit','on',true);
 BEGIN PERFORM public.crm_update_own_profile('Should Roll Back',null,null);
  RAISE EXCEPTION 'failed audit insert accepted'; EXCEPTION WHEN SQLSTATE 'P9001' THEN NULL; END;
 PERFORM set_config('build49.fail_profile_audit','off',true);
 IF (SELECT full_name FROM public.profiles WHERE id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')<>'Admin Alpha'
 THEN RAISE EXCEPTION 'failed audit did not roll back profile change'; END IF;
 SELECT count(*) INTO n FROM public.audit_logs;
 IF n<>2 THEN RAISE EXCEPTION 'expected two successful self-change audits, got %',n; END IF;
END $self_test$;
ROLLBACK;
SELECT 'PASS Build49 self-profile JWT-scoped field allowlist and audit rollback' AS outcome,
NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='profiles') AS no_persistent_profiles;