import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: Page });

function Page() {
  const { profile, role, refresh } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    department: profile?.department ?? "",
  });
  const save = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); refresh();
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile.</p>
      </div>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})}/></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
          <div className="space-y-2"><Label>Department</Label><Input value={form.department ?? ""} onChange={(e)=>setForm({...form,department:e.target.value})}/></div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
      {role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Data</CardTitle>
            <CardDescription>Bulk-upload Clients, Jobs, Candidates, Submissions, Interviews, Offers, and Billing from Excel or CSV.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link to="/import"><Upload className="h-4 w-4 mr-2"/>Open Import Tool</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
