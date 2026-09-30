-- ============ CAREERS PAGE / JOB BOARD POSTING (step 6 of the Zoho gap-closing plan) ============
-- Closes "Job board distribution" — rather than integrating with a real third-party
-- board (Indeed/Naukri/LinkedIn all require paid partner accounts and approval this
-- prototype doesn't have), this gives every open job a public, no-login page a
-- recruiter can share anywhere — a real job board's own posting, an email, a
-- WhatsApp message — where a candidate applies directly and lands straight in the
-- pipeline. Same trust model as step 3's scheduling links: no RLS change needed
-- here, because careers.functions.ts's public endpoints read/write through
-- supabaseAdmin (service role) exactly the way getSchedulingInfo/confirmSchedulingSlot
-- already do for an anonymous visitor with no Supabase session.
--
-- The one schema change: a per-job "Confidential" toggle (per the recommended
-- option — some staffing agreements restrict naming the client publicly, others
-- don't, and it varies job to job, not account-wide). Off by default: existing
-- jobs, and any new one, show the client's name on the public page unless a
-- recruiter explicitly checks this for a specific role.
ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false;