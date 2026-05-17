
-- 1. audit_logs read: admin only
DROP POLICY IF EXISTS "read audit" ON public.audit_logs;
CREATE POLICY "read audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. sync_logs insert: admin only (server writes use service role)
DROP POLICY IF EXISTS "system insert sync logs" ON public.sync_logs;
CREATE POLICY "admin insert sync logs" ON public.sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. notifications: remove broadcast clause
DROP POLICY IF EXISTS "read notif" ON public.notifications;
CREATE POLICY "read notif" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
