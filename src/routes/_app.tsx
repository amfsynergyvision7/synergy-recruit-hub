import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { session, loading, profile, signOut, role } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      const { count } = await supabase.from("notifications")
        .select("*", { count: "exact", head: true }).eq("is_read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel("hdr-notif").on("postgres_changes",
      { event: "*", schema: "public", table: "notifications" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (profile && (profile.status !== "approved" || !profile.is_active)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader><CardTitle>Account pending approval</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Your account status is <span className="font-medium capitalize text-foreground">{profile.status}</span>. An administrator must approve your access before you can use the CRM.</p>
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = (profile?.full_name || "U").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-card/80 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="text-sm font-semibold tracking-tight">AMF Synergy Vision CRM</div>
            <div className="ml-auto flex items-center gap-2">
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
                  <div className="text-xs font-medium">{profile?.full_name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{role ?? "—"}</div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
