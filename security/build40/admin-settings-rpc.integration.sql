BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
SET LOCAL statement_timeout='25s';
CREATE ROLE build40_anon NOLOGIN;
CREATE ROLE build40_auth NOLOGIN;
GRANT build40_anon TO postgres WITH SET TRUE, INHERIT FALSE;
GRANT build40_auth TO postgres WITH SET TRUE, INHERIT FALSE;
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TABLE public.profiles(id uuid,status text,is_active bool);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.app_settings(id int,logo_url text,default_color_theme text,resume_import_folder_url text,updated_by uuid,updated_at timestamptz);
CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id AND status='approved' AND is_active=true) $$;
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
INSERT INTO public.profiles VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),('11111111-1111-4111-8111-111111111111','approved',true),('22222222-2222-4222-8222-222222222222','pending',true),('33333333-3333-4333-8333-333333333333','approved',false);
INSERT INTO public.user_roles VALUES ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('11111111-1111-4111-8111-111111111111','recruiter'),('22222222-2222-4222-8222-222222222222','admin'),('33333333-3333-4333-8333-333333333333','admin');
INSERT INTO public.app_settings(id,logo_url,default_color_theme,resume_import_folder_url) VALUES(1,'synthetic logo','neon','synthetic private folder');
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_settings_read ON public.app_settings FOR SELECT TO PUBLIC USING(true);
REVOKE ALL ON public.app_settings FROM PUBLIC,build40_anon,build40_auth;
GRANT SELECT(id,logo_url,default_color_theme) ON public.app_settings TO build40_anon,build40_auth;
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
REVOKE EXECUTE ON FUNCTION public.crm_admin_get_resume_folder(),public.crm_admin_update_setting(text,text) FROM PUBLIC,build40_anon;
GRANT EXECUTE ON FUNCTION public.crm_admin_get_resume_folder(),public.crm_admin_update_setting(text,text) TO build40_auth;

DO $acl$ BEGIN
IF has_function_privilege('build40_anon','public.crm_admin_update_setting(text,text)','EXECUTE') THEN RAISE EXCEPTION 'anon update RPC exposed'; END IF;
IF has_function_privilege('build40_anon','public.crm_admin_get_resume_folder()','EXECUTE') THEN RAISE EXCEPTION 'anon read RPC exposed'; END IF;
IF NOT has_function_privilege('build40_auth','public.crm_admin_update_setting(text,text)','EXECUTE') THEN RAISE EXCEPTION 'auth RPC unavailable'; END IF;
IF has_column_privilege('build40_auth','public.app_settings','resume_import_folder_url','SELECT') THEN RAISE EXCEPTION 'private folder directly readable'; END IF;
IF has_column_privilege('build40_auth','public.app_settings','logo_url','UPDATE') THEN RAISE EXCEPTION 'browser direct write allowed'; END IF;
END $acl$;
SET ROLE build40_auth;
DO $checks$BEGIN
PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
BEGIN PERFORM public.crm_admin_get_resume_folder(); RAISE EXCEPTION 'recruiter read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
BEGIN PERFORM public.crm_admin_update_setting('logo_url','bad'); RAISE EXCEPTION 'recruiter write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
BEGIN PERFORM public.crm_admin_update_setting('logo_url','bad'); RAISE EXCEPTION 'pending admin write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
BEGIN PERFORM public.crm_admin_get_resume_folder(); RAISE EXCEPTION 'inactive admin read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
IF public.crm_admin_get_resume_folder()<>'synthetic private folder' THEN RAISE EXCEPTION 'admin read failed'; END IF;
IF NOT public.crm_admin_update_setting('default_color_theme','teal') THEN RAISE EXCEPTION 'theme update failed'; END IF;
IF NOT public.crm_admin_update_setting('logo_url',NULL) THEN RAISE EXCEPTION 'logo update failed'; END IF;
IF NOT public.crm_admin_update_setting('resume_import_folder_url','new synthetic folder') THEN RAISE EXCEPTION 'folder update failed'; END IF;
IF public.crm_admin_get_resume_folder()<>'new synthetic folder' THEN RAISE EXCEPTION 'folder readback failed'; END IF;
BEGIN PERFORM public.crm_admin_update_setting('updated_by','bad'); RAISE EXCEPTION 'invalid setting key accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
BEGIN PERFORM public.crm_admin_update_setting('default_color_theme','invalid'); RAISE EXCEPTION 'invalid theme accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $checks$;
RESET ROLE;
DO $verify$BEGIN
IF (SELECT updated_by FROM public.app_settings WHERE id=1)<>'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' THEN RAISE EXCEPTION 'updated_by spoofed'; END IF;
IF (SELECT default_color_theme FROM public.app_settings WHERE id=1)<>'teal' THEN RAISE EXCEPTION 'theme mismatch'; END IF;
END $verify$;
ROLLBACK;
SELECT 'PASS: admin-only settings RPC and private fields under 4 synthetic identities' AS result,NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='crm_admin_update_setting') AS no_rpc_remains;