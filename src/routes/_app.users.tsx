import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/users")({ component: Page });

const ROLES = ["admin","recruiter","operations","finance","viewer"] as const;

function Page() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at",{ascending:false}),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const roleMap: Record<string,string> = {};
    (roles||[]).forEach((r:any)=>{ roleMap[r.user_id]=r.role; });
    setUsers((profs||[]).map((p:any)=>({ ...p, role: roleMap[p.id] ?? "viewer" })));
  };
  useEffect(()=>{ load(); },[]);

  const updateStatus = async (id: string, status: "approved"|"pending"|"rejected"|"suspended") => {
    if (!isAdmin) return toast.error("Admin only");
    const { error } = await supabase.from("profiles").update({ status, is_active: status === "approved" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); load();
  };
  const updateActive = async (id: string, is_active: boolean) => {
    if (!isAdmin) return;
    await supabase.from("profiles").update({ is_active }).eq("id", id);
    load();
  };
  const updateRole = async (userId: string, newRole: string) => {
    if (!isAdmin) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Approve registrations, assign roles, and manage access.</p>
      </div>
      {!isAdmin && <Badge variant="secondary">Read-only — admin actions disabled</Badge>}
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
                      <Select value={u.role} onValueChange={(v)=>updateRole(u.id,v)}>
                        <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                        <SelectContent>{ROLES.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="capitalize">{u.role}</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {isAdmin && u.status!=="approved" && <Button size="sm" onClick={()=>updateStatus(u.id,"approved")}>Approve</Button>}
                    {isAdmin && u.status!=="rejected" && <Button size="sm" variant="outline" onClick={()=>updateStatus(u.id,"rejected")}>Reject</Button>}
                    {isAdmin && u.is_active && <Button size="sm" variant="outline" onClick={()=>updateActive(u.id,false)}>Suspend</Button>}
                    {isAdmin && !u.is_active && <Button size="sm" variant="outline" onClick={()=>updateActive(u.id,true)}>Activate</Button>}
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
