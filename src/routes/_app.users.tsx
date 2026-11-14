import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CRM_USER_ADMIN_MUTATIONS_ENABLED, manageCRMUser } from "@/lib/user-administration";
import { useAuth } from "@/hooks/use-auth";
import { canReadPrivateUserDirectory } from "@/lib/crm-sensitive-route-access";

export const Route = createFileRoute("/_app/users")({ component: Page });

const ROLES = ["admin","recruiter","operations","finance","viewer"] as const;

function Page() {
  const { user, profile, role } = useAuth();
  const allowed = canReadPrivateUserDirectory(user?.id, profile, role);
  const isAdmin = allowed;
  const canManageUsers = allowed && CRM_USER_ADMIN_MUTATIONS_ENABLED;
  const [users, setUsers] = useState<any[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setUsers([]);
    setLoadFailed(false);
    if (!allowed) return () => { active = false; controller.abort(); };
    const load = async () => {
      try {
        const [{ data: profs, error: profError }, { data: roles, error: rolesError }] = await Promise.all([
          supabase.from("profiles")
            .select("id, full_name, email, department, status, is_active, created_at")
            .order("created_at", { ascending: false }).limit(200).abortSignal(controller.signal),
          supabase.from("user_roles")
            .select("user_id, role").limit(200).abortSignal(controller.signal),
        ]);
        if (!active || controller.signal.aborted) return;
        if (profError || rolesError || !profs || !roles) throw new Error("Directory data unavailable");
        const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
        setUsers(profs.map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? "unassigned" })));
      } catch {
        if (active && !controller.signal.aborted) { setUsers([]); setLoadFailed(true); }
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [allowed, user?.id, reloadKey]);

  const updateStatus = async (id: string, status: "approved"|"pending"|"rejected"|"suspended") => {
    if (!canManageUsers) return toast.error("User administration is paused");
    const { error } = await manageCRMUser({ targetId: id, operation: "set_status", value: status });
    if (error) return toast.error(error.message);
    toast.success("Account status updated"); setReloadKey((n) => n + 1);
  };
  const updateActive = async (id: string, is_active: boolean) => {
    if (!canManageUsers) return toast.error("User administration is paused");
    const { error } = await manageCRMUser({ targetId: id, operation: "set_active", value: String(is_active) as "true"|"false" });
    if (error) return toast.error(error.message);
    toast.success("Account activity updated"); setReloadKey((n) => n + 1);
  };
  const updateRole = async (userId: string, newRole: string) => {
    if (!canManageUsers) return toast.error("User administration is paused");
    if (!(ROLES as readonly string[]).includes(newRole)) return toast.error("Unsupported role");
    const { error } = await manageCRMUser({
      targetId: userId, operation: "set_role", value: newRole as (typeof ROLES)[number],
    });
    if (error) return toast.error(error.message);
    toast.success("Account role updated"); setReloadKey((n) => n + 1);
  };

  if (!allowed)
    return <p className="text-sm text-muted-foreground">User directory access requires a verified administrator account.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Approve registrations, assign roles, and manage access.</p>
      </div>
      {!isAdmin && <Badge variant="secondary">Read-only — admin actions disabled</Badge>}
      {isAdmin && !canManageUsers && <Badge variant="secondary">User approvals and role changes are paused pending secure release</Badge>}
      {loadFailed && <p className="text-sm text-destructive">Unable to retrieve the authorized user directory.</p>}
      <Card><CardHeader><CardTitle className="text-base">{users.length} users</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead>
              <TableHead>Status</TableHead><TableHead>Active</TableHead><TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map(u=>(
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.department ?? "—"}</TableCell>
                  <TableCell><Badge variant={u.status==="approved"?"default":u.status==="pending"?"secondary":"destructive"}>{u.status}</Badge></TableCell>
                  <TableCell>{u.is_active?"Yes":"No"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={u.role} onValueChange={(v)=>updateRole(u.id,v)} disabled={!canManageUsers}>
                        <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                        <SelectContent>{ROLES.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="capitalize">{u.role}</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {canManageUsers && u.status!=="approved" && <Button size="sm" onClick={()=>updateStatus(u.id,"approved")}>Approve</Button>}
                    {canManageUsers && u.status!=="rejected" && <Button size="sm" variant="outline" onClick={()=>updateStatus(u.id,"rejected")}>Reject</Button>}
                    {canManageUsers && u.is_active && <Button size="sm" variant="outline" onClick={()=>updateActive(u.id,false)}>Suspend</Button>}
                    {canManageUsers && !u.is_active && <Button size="sm" variant="outline" onClick={()=>updateActive(u.id,true)}>Activate</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!users.length && <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No users</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
