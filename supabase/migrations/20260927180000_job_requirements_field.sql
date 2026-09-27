-- ============ JOB REQUIREMENTS FIELD ============
-- Free-text requirements/key-skills field for job openings. Needed so the
-- new AI candidate-match feature has something real to match candidates
-- against — without it, matching would only have job_title/location/salary
-- to go on, which is too thin to produce a meaningful score. Nullable, so
-- every existing job opening is unaffected until someone fills it in.
ALTER TABLE public.job_openings ADD COLUMN IF NOT EXISTS requirements TEXT;