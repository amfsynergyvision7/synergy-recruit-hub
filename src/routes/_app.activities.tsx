import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/activities")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const load = () =>
      supabase
        .from("candidate_activities" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)
        .then(({ data }) => setRows((data as any[]) || []));
    load();
    const ch = supabase
      .channel("activities-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "candidate_activities" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Candidate Timeline</h1>
        <p className="text-sm text-muted-foreground">Auto-generated activity log for stage-based automations.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{rows.length} entries</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Recruiter</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.candidate_name ?? "—"}</TableCell>
                  <TableCell>{r.recruiter_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{r.action_type}</Badge></TableCell>
                  <TableCell>{r.module_created ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate">{r.notes ?? ""}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No activity yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
