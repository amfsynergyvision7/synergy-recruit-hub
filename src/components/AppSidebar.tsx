import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, Briefcase, Send, CalendarCheck,
  FileSignature, Receipt, Bell, ScrollText, UserCog, Settings, LogOut, Upload, Plug, Activity, Sparkles, Users2, FileSpreadsheet, Workflow
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { BrandLogo, BrandCircuit } from "./BrandMark";
import { useColorTheme } from "@/hooks/use-color-theme";
import { hexToRgba } from "@/lib/color-themes";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Reports", url: "/reports", icon: FileSpreadsheet },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Job Openings", url: "/jobs", icon: Briefcase },
  { title: "AI Match", url: "/ai-match", icon: Sparkles },
  { title: "Submissions", url: "/submissions", icon: Send },
  { title: "Interviews", url: "/interviews", icon: CalendarCheck },
  { title: "Offers & Joining", url: "/offers", icon: FileSignature },
  { title: "Billing & Invoices", url: "/billing", icon: Receipt },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Activity Timeline", url: "/activities", icon: Activity },
  { title: "Audit Logs", url: "/audit", icon: ScrollText },
  { title: "User Management", url: "/users", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Workflow Rules", url: "/workflow-rules", icon: Workflow },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Import Data", url: "/import", icon: Upload },
  { title: "Duplicate Candidates", url: "/duplicates", icon: Users2 },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile, role, signOut } = useAuth();
  // The glow around the brand logo badge is tuned to each color theme's own
  // mandala hue (see src/lib/color-themes.ts) instead of a fixed cyan, so it
  // never clashes once a theme like Navy & Gold or Warm Coral is active.
  const { theme: colorTheme } = useColorTheme();
  const glow = hexToRgba(colorTheme.mandala[0], 0.6);

  return (
    <Sidebar collapsible="icon">
      <BrandCircuit
        className="absolute -top-20 -left-24 h-[95vh] w-[95vh] -z-10 pointer-events-none"
        style={{ opacity: 0.6 }}
      />
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center shadow-glow">
            <BrandLogo className="h-8 w-8" style={{ filter: `drop-shadow(0 0 5px ${glow})` }} />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">AMF Synergy Vision</span>
            <span className="text-[11px] text-sidebar-foreground/60">Recruitment CRM</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={path === item.url}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex justify-center mb-3 group-data-[collapsible=icon]:mb-2">
          <ThemeToggle />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs">
            <div className="font-medium truncate">{profile?.full_name}</div>
            <div className="text-muted-foreground truncate capitalize">{role ?? "—"}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}