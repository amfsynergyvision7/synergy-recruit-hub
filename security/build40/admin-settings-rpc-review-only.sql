-- BUILD40 REVIEW ONLY: admin settings RPC compatibility with restricted app_settings grants.
-- Requires independently reviewed Auth/JWT, storage, rollback and UI tests.
BEGIN;
CREATE FUNCTION public.crm_admin_get_resume_folder()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $rpc$
DECLARE v_uid uuid:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
BEGIN
 IF v_uid IS NULL OR NOT public.is_approved(v_uid) OR NOT public.has_role(v_uid,'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT resume_import_folder_url FROM public.app_settings WHERE id=1);
END $rpc$;
CREATE FUNCTION public.crm_admin_update_setting(p_key text,p_value text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $rpc$
DECLARE v_uid uuid:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; n integer;
BEGIN
 IF v_uid IS NULL OR NOT public.is_approved(v_uid) OR NOT public.has_role(v_uid,'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 IF p_key='default_color_theme' THEN
  IF p_value IS NULL OR p_value NOT IN('neon','navygold','emerald','coral','teal') THEN RAISE EXCEPTION 'Invalid theme' USING ERRCODE='22023'; END IF;
  UPDATE public.app_settings SET default_color_theme=p_value,updated_by=v_uid,updated_at=clock_timestamp() WHERE id=1;
 ELSIF p_key='logo_url' THEN
  IF p_value IS NOT NULL AND char_length(p_value)>2048 THEN RAISE EXCEPTION 'Logo URL too long' USING ERRCODE='22023'; END IF;
  UPDATE public.app_settings SET logo_url=p_value,updated_by=v_uid,updated_at=clock_timestamp() WHERE id=1;
 ELSIF p_key='resume_import_folder_url' THEN
  IF p_value IS NOT NULL AND char_length(p_value)>2048 THEN RAISE EXCEPTION 'Folder URL too long' USING ERRCODE='22023'; END IF;
  UPDATE public.app_settings SET resume_import_folder_url=p_value,updated_by=v_uid,updated_at=clock_timestamp() WHERE id=1;
 ELSE RAISE EXCEPTION 'Invalid setting key' USING ERRCODE='22023';
 END IF;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $rpc$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_get_resume_folder(),public.crm_admin_update_setting(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_admin_get_resume_folder(),public.crm_admin_update_setting(text,text) TO authenticated;
COMMIT;
-- Review-only: never enable before signed-user/API/browser and RLS compatibility proof.
