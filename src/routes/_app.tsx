import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { canMountApprovedCrm } from "@/lib/crm-shell-access";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BrandFacetBloom } from "@/components/BrandMark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { session, loading, profile, signOut, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  // A session alone does not authorize mounting private CRM pages.
  // Never render old search results/drafts while identity is changing.
  if (!canMountApprovedCrm(session.user.id, profile, role) || !role) {
    const pending = profile?.id === session.user.id && profile.status === "pending";
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader><CardTitle>CRM access not available</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{pending
              ? "Your account is awaiting administrator approval."
              : "An active, approved profile with a verified CRM role is required. Contact an administrator if you believe this is incorrect."}</p>
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // An account switch remounts all pages, search, drafts and subscriptions.
  return <ApprovedAppShell key={session.user.id} userId={session.user.id}
    fullName={profile!.full_name} role={role} />;
}

function ApprovedAppShell({
  userId, fullName, role,
}: { userId: string; fullName: string; role: AppRole }) {
  const { theme, toggle } = useTheme();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    let latest = 0;
    setUnread(0);
    const load = async () => {
      const request = ++latest;
      try {
        const { count, error } = await supabase.from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("is_read", false);
        if (active && request === latest) setUnread(error ? 0 : (count ?? 0));
      } catch {
        if (active && request === latest) setUnread(0);
      }
    };
    void load();
    // Explicitly filter realtime changes by the current Auth subject.
    const channel = supabase.channel(`hdr-notif-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => { void load(); }).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const initials = (fullName || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-card/80 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="min-w-0 truncate text-sm font-semibold tracking-tight">AMF Synergy Vision CRM</div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <GlobalSearch />
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link to="/notifications" className="relative">
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                </Button>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l">
                <div className="h-8 w-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-elegant">
                  {initials}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-medium">{fullName}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{role}</div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="relative isolate overflow-hidden min-h-full">
              <BrandFacetBloom
                className="absolute -top-24 -right-24 h-[75vh] w-[75vh] -z-10 pointer-events-none"
                style={{ opacity: 0.3 }}
              />
              <div className="p-6"><Outlet /></div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
