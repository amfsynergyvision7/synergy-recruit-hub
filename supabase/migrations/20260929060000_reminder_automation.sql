-- ============ REMINDER AUTOMATION (step 1 of the Zoho gap-closing plan) ============
-- Turns the existing "notifications" page from a shell (only a manual test button)
-- into a real reminder feed, generated hourly by pg_cron, covering exactly the four
-- kinds of reminder the page already promises: interviews, follow-ups, joinings, payments.

-- Track which record a reminder is about, so a re-run never creates the same reminder twice.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_table TEXT,
  ADD COLUMN IF NOT EXISTS related_id UUID;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_related_type_unique UNIQUE (related_table, related_id, type);

-- The existing "update notif" policy only let a user mark their OWN reminder read.
-- Payment reminders below are broadcast (user_id NULL, since billing has no assigned-recruiter
-- field) so anyone approved needs to be able to dismiss one for the whole team.
DROP POLICY IF EXISTS "update notif" ON public.notifications;
CREATE POLICY "update notif" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Generates today's reminders. Safe to call more than once a day: the unique constraint
-- above means a still-open issue is never re-notified, only genuinely new ones are inserted.
CREATE OR REPLACE FUNCTION public.generate_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- 1. Interview tomorrow (IST calendar day, so the boundary lines up with the office day)
  INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
  SELECT
    c.assigned_recruiter,
    'Interview tomorrow: ' || c.full_name,
    c.full_name || '''s ' || COALESCE(NULLIF(i.round, ''), 'interview') || ' is scheduled for ' ||
      to_char(i.interview_date, 'DD Mon') ||
      CASE WHEN i.interview_time IS NOT NULL THEN ' at ' || to_char(i.interview_time, 'HH12:MI AM') ELSE '' END,
    'interview_reminder',
    'interviews', i.id
  FROM public.interviews i
  JOIN public.candidates c ON c.id = i.candidate_id
  WHERE i.status = 'scheduled' AND i.interview_date = v_today + 1
  ON CONFLICT (related_table, related_id, type) DO NOTHING;

  -- 2. Payment overdue 15+ days — broadcast (no assigned-finance field on billing yet)
  INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
  SELECT
    NULL,
    'Payment overdue: ' || b.invoice_number,
    'Invoice ' || b.invoice_number || ' for ₹' || to_char(b.outstanding_amount, 'FM999,999,999.00') ||
      ' has been outstanding since ' || to_char(b.invoice_date, 'DD Mon YYYY'),
    'payment_overdue',
    'billing', b.id
  FROM public.billing b
  WHERE b.payment_status IN ('unpaid', 'partial', 'overdue')
    AND COALESCE(b.outstanding_amount, 0) > 0
    AND b.invoice_date <= v_today - 15
  ON CONFLICT (related_table, related_id, type) DO NOTHING;

  -- 3. Joining check-in — joining date has arrived but nobody confirmed the candidate joined
  INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
  SELECT
    c.assigned_recruiter,
    'Joining check-in: ' || c.full_name,
    c.full_name || '''s joining date (' || to_char(o.joining_date, 'DD Mon') || ') has arrived — confirm they joined',
    'joining_followup',
    'offers', o.id
  FROM public.offers o
  JOIN public.candidates c ON c.id = o.candidate_id
  WHERE o.joining_status = 'pending' AND o.joining_date IS NOT NULL AND o.joining_date <= v_today
  ON CONFLICT (related_table, related_id, type) DO NOTHING;

  -- 4. Stalled candidate — active pipeline stage, no update in 7+ days
  INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
  SELECT
    c.assigned_recruiter,
    'Follow-up needed: ' || c.full_name,
    c.full_name || ' has been in "' || replace(c.stage::text, '_', ' ') || '" for ' ||
      (v_today - c.updated_at::date)::text || ' days with no update',
    'stalled_followup',
    'candidates', c.id
  FROM public.candidates c
  WHERE c.stage NOT IN ('joined', 'rejected', 'dropped')
    AND c.updated_at < now() - INTERVAL '7 days'
  ON CONFLICT (related_table, related_id, type) DO NOTHING;
END;
$$;

-- Runs every hour, on the hour. cron.schedule() replaces an existing job of the same name,
-- so re-applying this migration is harmless.
SELECT cron.schedule('generate-reminders-hourly', '0 * * * *', $$ SELECT public.generate_reminders(); $$);

-- Seed immediately so today's reminders show up as soon as this migration is applied,
-- rather than waiting for the next hourly tick.
SELECT public.generate_reminders();