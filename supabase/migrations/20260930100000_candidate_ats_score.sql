-- ATS Resume Maker: adds the compatibility-checker's persisted result to the
-- candidate record (user chose "save it to the candidate record" over
-- generating it fresh every time). Same one-line ALTER TABLE style as
-- 20260927200000_candidate_resume_summary.sql — a plain column addition on
-- an existing, already-RLS-covered table needs no new policy.
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS ats_score INTEGER;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS ats_issues JSONB;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS ats_checked_at TIMESTAMPTZ;