-- ============ EMAIL SENDING (step 2 of the Zoho gap-closing plan) ============
-- Adds a record of every email the CRM sends on a recruiter's behalf (via
-- Resend, see src/lib/email.server.ts) so "did we already email this
-- candidate, and what did we say" has a real answer instead of living only
-- in someone's personal inbox.

CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  related_table TEXT NOT NULL,
  related_id UUID NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  provider_id TEXT,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Same read/write shape as every other business table: any approved user can
-- see the correspondence history, only admin/recruiter can send (matching
-- canEdit()'s rule for Candidates and Clients — the only two modules with
-- emailField configured), nobody can edit or delete a sent record — it's a
-- log, not a draft.
CREATE POLICY "read email_log" ON public.email_log FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "insert email_log" ON public.email_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));

CREATE INDEX email_log_related_idx ON public.email_log (related_table, related_id, created_at DESC);