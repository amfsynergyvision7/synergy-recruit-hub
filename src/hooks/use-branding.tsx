import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BrandingCtx {
  logoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<BrandingCtx>({
  logoUrl: null,
  loading: true,
  refresh: async () => {},
});

// App-wide branding (currently just the uploaded company logo), loaded once
// at the root so it's available on every route — including /login, which
// has no session yet and relies on the table's public-read policy.
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("logo_url")
      .eq("id", 1)
      .maybeSingle();
    setLogoUrl(data?.logo_url ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return <Ctx.Provider value={{ logoUrl, loading, refresh: load }}>{children}</Ctx.Provider>;
}

export function useBranding() {
  return useContext(Ctx);
}