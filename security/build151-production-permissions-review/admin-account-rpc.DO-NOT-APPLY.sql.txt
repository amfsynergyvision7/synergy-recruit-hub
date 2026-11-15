-- BUILD49 REVIEW ONLY: audited and atomic CRM user administration.
-- NOT AN ACTIVE MIGRATION; DO NOT APPLY TO STAGING OR PRODUCTION.
-- The existing UI direct profile/role writes are incompatible with the 35-policy
-- lockdown. This RPC is a proposed replacement, not permission to activate it.
BEGIN;
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
COMMIT;
-- RELEASE HOLD: No hosted change, no current preview activation. Production
-- needs independently approved business policy + real hosted Auth/UI tests.
