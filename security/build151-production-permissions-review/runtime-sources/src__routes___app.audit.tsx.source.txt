/**
 * Build134: exact-count, role-scoped read-only administrative audit timeline.
 * This browser projection is not RLS authorization or a signed hosted audit.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canReadAuditLogs } from "@/lib/crm-report-access";
import { supabase } from "@/integrations/supabase/client";
import { CRM_MAX_ROWS, readCompleteCrmRows, sortCompleteCrmRows } from "@/lib/bounded-crm-read";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/audit")({ component: Page });

type AuditMetadata = {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
};

function Page() {
  const { user, profile, role, loading } = useAuth();
  // Keep every private hook and cache behind the exact approved subject.
  if (loading || !canReadAuditLogs(user?.id, profile, role))
    return <p className="text-sm text-muted-foreground">Audit records require verified administrator access.</p>;
  return <VerifiedAuditWorkspace key={user!.id + ":" + role} />;
}

function VerifiedAuditWorkspace() {
  const { user, profile, role } = useAuth();
  const allowed = canReadAuditLogs(user?.id, profile, role);
  const [rows, setRows] = useState<AuditMetadata[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setRows([]);
    setFailed(false);
    setLoading(true);
    if (!allowed) return () => { active = false; controller.abort(); };
    const load = async () => {
      try {
        // No before/after payloads, candidate PII, raw tokens or email.
        // Read all authorized audit metadata using stable ID pages, not
        // a silent 200-row newest-first truncation.
        const data = await readCompleteCrmRows<AuditMetadata>(
          async (from, to, signal) => {
            const result = await supabase.from("audit_logs")
              .select("id, created_at, user_id, action, table_name, record_id", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(signal);
            return { data: result.data, count: result.count, error: result.error };
          }, controller.signal);
        if (active && !controller.signal.aborted)
          setRows(sortCompleteCrmRows(data, "created_at", false));
      } catch {
        if (active && !controller.signal.aborted) {
          setRows([]);
          setFailed(true);
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [allowed, user?.id, reloadKey]);

  if (!allowed) return <p className="text-sm text-muted-foreground">Audit records require verified administrator access.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Restricted administrative action metadata. Personal payloads are not displayed.
          Exact-count read up to {CRM_MAX_ROWS} role-visible entries; incomplete history is withheld.
        </p>
        {failed && <p className="text-sm text-destructive">
          Unable to load or verify complete authorized audit metadata. No partial history is shown.
        </p>}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {loading ? "Verifying audit history…" : failed ? "Audit count unavailable" : `${rows.length} verified entries`}
          </CardTitle>
          <Button variant="outline" size="sm" disabled={loading}
            onClick={() => setReloadKey(n => n + 1)}>
            <RefreshCw className="mr-1.5 h-4 w-4"/>Refresh
          </Button>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? <p className="text-sm text-muted-foreground">Checking complete audit entries…</p> :
          failed ? null :
          <Table>
            <TableHeader><TableRow>
              <TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead>
              <TableHead>Table</TableHead><TableHead>Record</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(row=>(
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell>{row.user_id ?? "—"}</TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.table_name ?? "—"}</TableCell>
                  <TableCell>{row.record_id ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={5}
                className="text-center py-8 text-sm text-muted-foreground">
                No role-visible audit entries in the verified complete result
              </TableCell></TableRow>}
            </TableBody>
          </Table>}
        </CardContent>
      </Card>
    </div>
  );
}
