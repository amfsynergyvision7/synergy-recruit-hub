import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { canReadCandidateActivityMetadata } from "@/lib/crm-sensitive-route-access";

export const Route = createFileRoute("/_app/activities")({ component: Page });

function Page() {
  const { user, profile, role } = useAuth();
  const allowed = canReadCandidateActivityMetadata(user?.id, profile, role);
  const [rows, setRows] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setRows([]);
    setFailed(false);
    if (!allowed) return () => { active = false; controller.abort(); };
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("candidate_activities" as any)
          .select("id, created_at, action_type, module_created")
          .order("created_at", { ascending: false })
          .limit(200).abortSignal(controller.signal);
        if (!active || controller.signal.aborted) return;
        if (error || !data) throw new Error("Activity data unavailable");
        setRows(data as any[]);
      } catch {
        if (active && !controller.signal.aborted) { setRows([]); setFailed(true); }
      }
    };
    void load();
    // Do not subscribe to ALL candidate row events: cross-record realtime
    // events are not a substitute for server-authorized row filtering.
    return () => { active = false; controller.abort(); };
  }, [allowed, user?.id]);
  if (!allowed)
    return <p className="text-sm text-muted-foreground">Candidate activity metadata requires administrator access.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Candidate Timeline</h1>
        <p className="text-sm text-muted-foreground">Restricted action metadata. Candidate names, recruiter names and notes are excluded.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{rows.length} entries</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          {failed && <p className="text-sm text-destructive">Unable to retrieve authorized activity metadata.</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{r.action_type}</Badge></TableCell>
                  <TableCell>{r.module_created ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No activity yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
