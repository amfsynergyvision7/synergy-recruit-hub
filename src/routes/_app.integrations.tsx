import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles, History, AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { getIntegration, saveIntegration, detectHeaders, triggerSync, getSyncLogs } from "@/lib/integrations.functions";
import { CANDIDATE_FIELDS } from "@/lib/candidate-fields";

export const Route = createFileRoute("/_app/integrations")({ component: Page });

function Page() {
  const { role } = useAuth();
  if (role && role !== "admin") return <Navigate to="/dashboard" />;

  const qc = useQueryClient();
  const fetchIntegration = useServerFn(getIntegration);
  const save = useServerFn(saveIntegration);
  const detect = useServerFn(detectHeaders);
  const sync = useServerFn(triggerSync);
  const fetchLogs = useServerFn(getSyncLogs);

  const integQ = useQuery({ queryKey: ["integration"], queryFn: () => fetchIntegration() });
  const logsQ = useQuery({ queryKey: ["sync-logs"], queryFn: () => fetchLogs(), refetchInterval: 10000 });

  const [form, setForm] = useState({ sheet_url: "", sheet_name: "Form Responses 1", header_row: 1, auto_sync: false });
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (integQ.data) {
      setForm({
        sheet_url: integQ.data.sheet_url ?? "",
        sheet_name: integQ.data.sheet_name ?? "Form Responses 1",
        header_row: integQ.data.header_row ?? 1,
        auto_sync: !!integQ.data.auto_sync,
      });
      setMapping((integQ.data.column_mapping as any) ?? {});
    }
  }, [integQ.data]);

  const detectMut = useMutation({
    mutationFn: () => detect({ data: { sheet_url: form.sheet_url, sheet_name: form.sheet_name, header_row: form.header_row } }),
    onSuccess: (r: any) => { const hs = Array.isArray(r?.headers) ? r.headers : []; setHeaders(hs); setMapping((m) => ({ ...(r?.suggested ?? {}), ...m })); toast.success(`Detected ${hs.length} columns`); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => save({ data: { ...form, column_mapping: mapping } }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["integration"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: (full: boolean) => sync({ data: { fullHistory: full } }),
    onSuccess: (r) => {
      toast.success(`Sync done: ${r.rows_created} created, ${r.rows_updated} updated, ${r.rows_skipped} skipped`);
      qc.invalidateQueries({ queryKey: ["integration"] }); qc.invalidateQueries({ queryKey: ["sync-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const status = integQ.data?.last_status;
  const statusVariant: any = status === "success" ? "default" : status === "partial" ? "secondary" : status === "error" ? "destructive" : "outline";

  const mappedHeaders = useMemo(() => headers.length ? headers : Object.keys(mapping ?? {}), [headers, mapping]);
  const logs = Array.isArray(logsQ.data) ? logsQ.data : [];

  if (integQ.isError) {
    // surface error but don't crash
    console.error("integration load error", integQ.error);
  }
  if (logsQ.isError) {
    console.error("sync logs load error", logsQ.error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect external services. Auto-sync runs every 2 minutes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5"/>Google Sheets → Candidates</CardTitle>
          <CardDescription>Sync new Google Form responses into the candidate pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-3 space-y-2">
              <Label>Google Sheet URL</Label>
              <Input value={form.sheet_url} onChange={(e) => setForm({ ...form, sheet_url: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"/>
            </div>
            <div className="space-y-2">
              <Label>Sheet (tab) name</Label>
              <Input value={form.sheet_name} onChange={(e) => setForm({ ...form, sheet_name: e.target.value })}/>
            </div>
            <div className="space-y-2">
              <Label>Header row</Label>
              <Input type="number" min={1} value={form.header_row}
                onChange={(e) => setForm({ ...form, header_row: Number(e.target.value) || 1 })}/>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.auto_sync} onCheckedChange={(v) => setForm({ ...form, auto_sync: v })}/>
                <Label>Auto sync (every 2 min)</Label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => detectMut.mutate()} disabled={!form.sheet_url || detectMut.isPending}>
              {detectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>} Detect columns
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin"/>} Save settings
            </Button>
            <Button variant="secondary" onClick={() => syncMut.mutate(false)} disabled={syncMut.isPending || !integQ.data?.spreadsheet_id}>
              {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>} Sync new rows
            </Button>
            <Button variant="outline" onClick={() => syncMut.mutate(true)} disabled={syncMut.isPending || !integQ.data?.spreadsheet_id}>
              <History className="h-4 w-4"/> Import full history
            </Button>
          </div>

          {mappedHeaders.length > 0 && (
            <div className="space-y-2">
              <Label>Column mapping (Sheet → CRM field)</Label>
              <div className="border rounded-lg divide-y">
                {mappedHeaders.map((h) => (
                  <div key={h} className="grid grid-cols-2 gap-3 p-3 items-center">
                    <div className="text-sm font-medium truncate">{h}</div>
                    <Select value={mapping[h] ?? "__none"} onValueChange={(v) => {
                      const next = { ...mapping }; if (v === "__none") delete next[h]; else next[h] = v; setMapping(next);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Ignore"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Ignore —</SelectItem>
                        {CANDIDATE_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
          <CardContent><Badge variant={statusVariant}>{status ?? "not synced"}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Last sync</CardTitle></CardHeader>
          <CardContent className="text-sm">{integQ.data?.last_sync_at ? new Date(integQ.data.last_sync_at).toLocaleString() : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Last synced row</CardTitle></CardHeader>
          <CardContent className="text-sm">{integQ.data?.last_synced_row ?? 1}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Sync history</CardTitle><CardDescription>Most recent 50 runs.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead>
              <TableHead>Created</TableHead><TableHead>Updated</TableHead><TableHead>Skipped</TableHead><TableHead>Errors</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{l.created_at ? new Date(l.created_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs">{l.triggered_by}</TableCell>
                  <TableCell>
                    {l.status === "success" ? <Badge><CheckCircle2 className="h-3 w-3 mr-1"/>success</Badge>
                      : l.status === "partial" ? <Badge variant="secondary">partial</Badge>
                      : <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1"/>error</Badge>}
                  </TableCell>
                  <TableCell>{l.rows_created ?? 0}</TableCell>
                  <TableCell>{l.rows_updated ?? 0}</TableCell>
                  <TableCell>{l.rows_skipped ?? 0}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {Array.isArray(l.errors) && l.errors.length ? l.errors.map((e: any) => `R${e.row ?? "?"}: ${e.message ?? ""}`).join(" | ") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No sync runs yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
