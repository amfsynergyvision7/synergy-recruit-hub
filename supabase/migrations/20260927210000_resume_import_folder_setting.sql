-- Adds the one place the "Check Google Drive for new resumes" bulk-import
-- feature reads its target folder from. Lives on the existing app_settings
-- singleton row (same one that already holds the company logo) so it's
-- editable from the Settings page without any new table or extra RLS setup
-- — the existing "public read app settings" / "admin update app settings"
-- policies on this table already cover the new column automatically.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS resume_import_folder_url TEXT;