import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, Briefcase, Send, CalendarCheck,
  FileSignature, Receipt, Bell, ScrollText, UserCog, Settings, LogOut, Upload, Plug, Activity
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Job Openings", url: "/jobs", icon: Briefcase },
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
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Import Data", url: "/import", icon: Upload },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile, role, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg gradient-primary text-primary-foreground flex items-center justify-center font-bold shadow-glow">A</div>
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