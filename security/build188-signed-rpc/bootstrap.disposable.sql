-- BUILD188 DISPOSABLE PG17 ONLY. DO NOT RUN ON HOSTED SYSTEMS.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticator LOGIN PASSWORD 'b188_disposable_authenticator_only_6r4h';
GRANT anon,authenticated,service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,authenticator;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role,authenticator;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance');
CREATE TABLE public.user_roles(user_id uuid NOT NULL,role public.app_role NOT NULL,PRIMARY KEY(user_id,role));
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC,anon,authenticated;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','admin'),
 ('22222222-2222-4222-8222-222222222222','recruiter'),
 ('33333333-3333-4333-8333-333333333333','finance');
-- GUC-backed mock of Supabase auth.uid() (not actual GoTrue).
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),'')::uuid,
 nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid);
$body$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
-- Reproduce legacy broad helper permissions and explicit service grant.
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $legacy$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$legacy$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role)
 TO anon,authenticated,service_role;
-- Exactly the unexecuted GitHub review proposal, applied here ONLY.
\i security/build187-role-helper/has-role-current-user.DO-NOT-APPLY.sql.txt
CREATE TABLE public.audit_probe(id uuid PRIMARY KEY,sample text NOT NULL);
CREATE TABLE public.candidate_probe(id uuid PRIMARY KEY,sample text NOT NULL);
INSERT INTO public.audit_probe VALUES ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic audit');
INSERT INTO public.candidate_probe VALUES ('ccccccc1-cccc-4ccc-8ccc-cccccccccccc','synthetic candidate');
ALTER TABLE public.audit_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_probe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "B188 admin-only audit SELECT" ON public.audit_probe
 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "B188 approved staff sample SELECT" ON public.candidate_probe
 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)
 OR public.has_role(auth.uid(),'recruiter'::public.app_role));
GRANT SELECT ON public.audit_probe,public.candidate_probe TO authenticated;
DO $verify$
BEGIN
 IF has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.has_role(uuid,public.app_role)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.has_role(uuid,public.app_role)','EXECUTE')
 OR has_table_privilege('authenticated','public.user_roles','SELECT')
 THEN RAISE EXCEPTION 'BUILD188_BAD_FIXTURE_ACL'; END IF;
 RAISE NOTICE 'BUILD188_DISPOSABLE_POSTGREST_FIXTURE_READY';
END $verify$;