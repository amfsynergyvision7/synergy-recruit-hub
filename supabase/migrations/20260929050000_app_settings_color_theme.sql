-- Org-wide default color theme (Settings → Theme), on the same app_settings
-- singleton row that already holds the company logo and the Drive import
-- folder — so no new table or RLS policy is needed; the existing
-- "public read app settings" / "admin update app settings" policies on this
-- table already cover the new column automatically. A user who has picked
-- their own theme in their browser (localStorage) keeps that choice; this
-- column only decides what a browser that never chose one sees, including a
-- signed-out visitor on the login page.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_color_theme TEXT NOT NULL DEFAULT 'neon';