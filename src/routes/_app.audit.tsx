import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/audit")({ component: Page });

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(200)
      .then(({data})=>setRows(data||[]));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">All sensitive actions performed in the CRM.</p>
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
                  <TableCell>{r.user_email ?? r.user_id ?? "—"}</TableCell>
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
