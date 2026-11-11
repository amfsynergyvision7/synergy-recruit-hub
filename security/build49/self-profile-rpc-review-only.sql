-- BUILD49 REVIEW ONLY: self-profile edit compatibility with restrictive RLS.
-- Never allow direct authenticated UPDATE on public.profiles. No production write.
BEGIN;
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
COMMIT;
-- RELEASE HOLD: approval and real hosted browser/API acceptance required.
