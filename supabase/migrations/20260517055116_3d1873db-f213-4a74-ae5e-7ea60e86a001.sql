
-- 1. notifications: restrict insert to self or admin
DROP POLICY IF EXISTS "insert notif" ON public.notifications;
CREATE POLICY "insert notif" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. user_roles: only own row, admins see all
DROP POLICY IF EXISTS "approved read roles" ON public.user_roles;
CREATE POLICY "self read role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. audit_logs: restrict client inserts to admin (SECURITY DEFINER triggers bypass RLS)
DROP POLICY IF EXISTS "insert audit" ON public.audit_logs;
CREATE POLICY "insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. candidate_activities: remove permissive insert; only SECURITY DEFINER trigger writes
DROP POLICY IF EXISTS "insert activities" ON public.candidate_activities;
