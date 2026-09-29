import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isColorThemeId, type ColorThemeId } from "@/lib/color-themes";

interface BrandingCtx {
  logoUrl: string | null;
  defaultColorTheme: ColorThemeId;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BrandingCtx>({
  logoUrl: null,
  defaultColorTheme: "neon",
  loading: true,
  refresh: async () => {},
});

// App-wide branding — the uploaded company logo and the org-wide default
// color theme — loaded once at the root so it's available on every route,
// including /login, which has no session yet and relies on the table's
// public-read policy.
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [defaultColorTheme, setDefaultColorTheme] = useState<ColorThemeId>("neon");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("logo_url, default_color_theme")
      .eq("id", 1)
      .maybeSingle();
    setLogoUrl(data?.logo_url ?? null);
    setDefaultColorTheme(isColorThemeId(data?.default_color_theme) ? data.default_color_theme : "neon");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return <Ctx.Provider value={{ logoUrl, defaultColorTheme, loading, refresh: load }}>{children}</Ctx.Provider>;
}

export function useBranding() {
  return useContext(Ctx);
}