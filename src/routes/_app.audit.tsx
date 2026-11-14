import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canReadAuditLogs } from "@/lib/crm-report-access";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/audit")({ component: Page });

function Page() {
  const { user, profile, role } = useAuth();
  const allowed = canReadAuditLogs(user?.id, profile, role);
  const [rows, setRows] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setRows([]);
    setFailed(false);
    if (!allowed) return () => { active = false; };
    // Never fetch raw before/after payloads, email addresses or tokens.
    void supabase.from("audit_logs")
      .select("id, created_at, user_id, action, table_name, record_id")
      .order("created_at",{ascending:false}).limit(200)
      .then(({data, error})=>{
        if (!active) return;
        if (error) { setRows([]); setFailed(true); }
        else setRows(data ?? []);
      }).catch(()=>{
        if (active) { setRows([]); setFailed(true); }
      });
    return () => { active = false; };
  }, [allowed, user?.id]);
  if (!allowed) return <p className="text-sm text-muted-foreground">Audit records require verified administrator access.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Restricted administrative action metadata. Personal payloads are not displayed.</p>
        {failed && <p className="text-sm text-destructive">Unable to load audit metadata.</p>}
      </div>
      <Card><CardHeader><CardTitle className="text-base">{rows.length} entries</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead>
              <TableHead>Table</TableHead><TableHead>Record</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r=>(
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.user_id ?? "—"}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell>{r.table_name ?? "—"}</TableCell>
                  <TableCell>{r.record_id ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No audit entries yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
