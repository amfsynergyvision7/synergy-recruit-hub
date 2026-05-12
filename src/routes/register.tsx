import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    department: "", role_request: "recruiter",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: form.full_name,
          phone: form.phone,
          department: form.department,
          role_request: form.role_request,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Awaiting admin approval.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>New accounts require admin approval before access is granted.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2"><Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e)=>setForm({...form, full_name:e.target.value})}/></div>
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/></div>
            <div className="space-y-2"><Label>Phone</Label>
              <Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})}/></div>
            <div className="space-y-2"><Label>Password</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})}/></div>
            <div className="space-y-2"><Label>Department</Label>
              <Input value={form.department} onChange={(e)=>setForm({...form, department:e.target.value})}/></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Role request</Label>
              <Select value={form.role_request} onValueChange={(v)=>setForm({...form, role_request:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between">
              <Link to="/login" className="text-sm text-muted-foreground hover:underline">Already have an account?</Link>
              <Button type="submit" disabled={loading}>{loading?"Creating…":"Create account"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
