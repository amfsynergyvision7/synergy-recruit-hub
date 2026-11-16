-- BUILD189 DISPOSABLE AUTH + POSTGREST TEST, NOT A MIGRATION.
-- Executes only in ephemeral postgres:17 after copied Build42 GoTrue schema,
-- GoTrue applies its auth namespace migrations, and before any test signups.
-- No hosted project, user, candidate, CRM or private business data.
\set ON_ERROR_STOP on
CREATE ROLE authenticator LOGIN PASSWORD 'build189_ephemeral_authenticator_only_7w5q';
GRANT anon,authenticated,service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role,authenticator;
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','finance');
CREATE TABLE public.user_roles(user_id uuid NOT NULL,role public.app_role NOT NULL,
 PRIMARY KEY(user_id,role));
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM PUBLIC,anon,authenticated;
-- No actual users or assignments inserted here: GoTrue creates ephemeral
-- auth.users and issues real JWTs; our isolated Node suite inserts fictional
-- business role memberships tied to the resulting new GoTrue UUIDs.
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
 AS $legacy$ SELECT EXISTS(SELECT 1 FROM public.user_roles
                           WHERE user_id=_user_id AND role=_role) $legacy$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role)
 TO anon,authenticated,service_role;
-- Exact Build187 DO-NOT-APPLY proposal applies ONLY to this ephemeral DB.
\i security/build187-role-helper/has-role-current-user.DO-NOT-APPLY.sql.txt
CREATE TABLE public.audit_probe(id uuid PRIMARY KEY,sample text NOT NULL);
CREATE TABLE public.candidate_probe(id uuid PRIMARY KEY,sample text NOT NULL);
INSERT INTO public.audit_probe VALUES ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fictional audit');
INSERT INTO public.candidate_probe VALUES ('ccccccc1-cccc-4ccc-8ccc-cccccccccccc','fictional candidate');
ALTER TABLE public.audit_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_probe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Build189 only admin audit reader" ON public.audit_probe
 FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Build189 admin or recruiter reader" ON public.candidate_probe
 FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin'::public.app_role) OR
        public.has_role(auth.uid(),'recruiter'::public.app_role));
GRANT SELECT ON public.audit_probe,public.candidate_probe TO authenticated;
DO $check$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.has_role(uuid,public.app_role)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.has_role(uuid,public.app_role)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',
  'public.has_role(uuid,public.app_role)','EXECUTE')
 OR pg_catalog.has_table_privilege('authenticated','public.user_roles','SELECT')
 THEN RAISE EXCEPTION 'Build189 disposable role helper ACL incorrect'; END IF;
 RAISE NOTICE 'BUILD189_GOTRUE_APP_FIXTURE_READY';
END $check$;
