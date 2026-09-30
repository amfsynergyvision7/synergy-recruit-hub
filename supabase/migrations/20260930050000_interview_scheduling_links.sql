-- ============ INTERVIEW SCHEDULING LINKS (step 3 of the Zoho gap-closing plan) ============
-- A recruiter offers up to 3 candidate time slots and gets a shareable public
-- link; the candidate picks one with no login required. Deliberately reuses
-- the interviews table's own status/date/time columns rather than a separate
-- table, so the existing interviews_stage_trigger (fires on UPDATE OF status)
-- keeps working unchanged: the moment a slot is confirmed and status flips to
-- 'scheduled', the candidate's pipeline stage advances exactly as it already
-- does today for a manually-entered interview.
--
-- scheduling_token is only set once a recruiter actually requests a link (see
-- ScheduleLinkButton.tsx) — it's nullable, not backfilled for existing rows,
-- so a plain UNIQUE index (Postgres allows any number of NULLs under one) is
-- enough without a partial index.
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS scheduling_token UUID,
  ADD COLUMN IF NOT EXISTS proposed_slots JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS interviews_scheduling_token_idx ON public.interviews (scheduling_token);

-- Public, unauthenticated lookups (the candidate has no CRM account) go
-- through supabaseAdmin in src/lib/scheduling.functions.ts, which bypasses
-- RLS entirely and only ever selects/updates by scheduling_token — so no new
-- RLS policy is needed here for anon access. The existing "read int" / "update
-- int" policies (approved users only) are untouched and still govern the
-- normal authenticated CrudModule views.