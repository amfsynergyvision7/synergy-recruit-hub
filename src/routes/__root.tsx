import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { BrandingProvider, useBranding } from "@/hooks/use-branding";
import { useColorTheme } from "@/hooks/use-color-theme";
import { Toaster } from "@/components/ui/sonner";

// Applies the org-wide default color theme (from app_settings, via
// BrandingProvider) as early as possible on every route, including /login,
// which has no session yet. Renders nothing — useColorTheme's own effect is
// what writes the CSS custom properties onto <html>. Individual components
// (BrandMark, the sidebar/login glow, the Settings picker) each call
// useColorTheme() again themselves to read or change the active theme; all
// mounted calls stay in sync via the hook's own broadcast event.
function ColorThemeBootstrap() {
  const { defaultColorTheme } = useBranding();
  useColorTheme(defaultColorTheme);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AMF Synergy Vision — Recruitment CRM" },
      { name: "description", content: "Cloud-based recruitment & staffing CRM for AMF Synergy Vision." },
      { property: "og:title", content: "AMF Synergy Vision — Recruitment CRM" },
      { name: "twitter:title", content: "AMF Synergy Vision — Recruitment CRM" },
      { property: "og:description", content: "Cloud-based recruitment & staffing CRM for AMF Synergy Vision." },
      { name: "twitter:description", content: "Cloud-based recruitment & staffing CRM for AMF Synergy Vision." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/sPWNKESV05OSIY3MMKo9eeN60jx2/social-images/social-1778593823629-AMF_SV_New_Logo.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/sPWNKESV05OSIY3MMKo9eeN60jx2/social-images/social-1778593823629-AMF_SV_New_Logo.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      // Lets a phone install this as a home-screen app (see public/manifest.webmanifest
      // + public/sw.js). theme-color tints the OS status bar/task-switcher to match
      // the app's own dark chrome instead of leaving it default white.
      { name: "theme-color", content: "#12142a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AMF CRM" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Registering the (deliberately no-op) service worker is what actually
  // makes the manifest's "install as app" behavior available on Android/
  // Chrome — the manifest alone isn't enough there. iOS Safari doesn't use
  // this at all (its "Add to Home Screen" only ever reads the manifest/meta
  // tags), so this quietly does nothing there, which is fine.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not a requirement — a failed
        // registration (unsupported browser, blocked by an extension, etc.)
        // should never surface as an error to the user.
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ColorThemeBootstrap />
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}