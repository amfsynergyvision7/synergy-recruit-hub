import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { canReadCandidateActivityMetadata } from "@/lib/crm-sensitive-route-access";
import { CRM_MAX_ROWS, readCompleteCrmRows, sortCompleteCrmRows } from "@/lib/bounded-crm-read";

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
        // Exact-count, bounded ID pages. The old 200-row implicit cap
        // presented an incomplete activity history as a full timeline.
        // RLS remains responsible for the caller's row authorization.
        const data = await readCompleteCrmRows(async (from, to, signal) => {
          const result = await supabase.from("candidate_activities")
            .select("id, created_at, action_type, module_created", { count: "exact" })
            .order("id", { ascending: true }).range(from, to).abortSignal(signal);
          return { data: result.data, count: result.count, error: result.error };
        }, controller.signal);
        if (!active || controller.signal.aborted) return;
        setRows(sortCompleteCrmRows(data, "created_at", false));
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
        <p className="text-sm text-muted-foreground">Restricted, verified activity metadata (maximum {CRM_MAX_ROWS} records). Candidate names, recruiter names and notes are excluded. No partial timeline is displayed.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{failed ? "Activity count unavailable" : `${rows.length} verified entries`}</CardTitle></CardHeader>
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
              {!rows.length && !failed && (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No activity yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
