-- ============ APP SETTINGS (branding) ============
-- Single-row, app-wide settings table. Starts out holding just the company
-- logo, but is a natural home for any future "one setting for the whole
-- org" value (e.g. a default currency, a support email). The CHECK on id
-- pins it to exactly one row.
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER t_app_settings_u BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Readable by everyone, including signed-out visitors — the login page
-- needs the logo before there's a session, same as any public CDN asset.
-- Only admins can change it.
CREATE POLICY "public read app settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin update app settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ BRANDING STORAGE BUCKET ============
-- Public bucket for the uploaded company logo image. Public so it can be
-- loaded directly by URL from the login page and anywhere else, same as any
-- other CDN-hosted logo — there is nothing sensitive in a company logo file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read branding assets" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'branding');
CREATE POLICY "admin upload branding assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update branding assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete branding assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));