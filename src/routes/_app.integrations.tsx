import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { canReadPrivateUserDirectory } from "@/lib/crm-sensitive-route-access";
import { CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED, CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED, CRM_INTEGRATION_MUTATION_HOLD_REASON } from "@/lib/release-safety";
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
import { CANDIDATE_FIELDS, CANDIDATE_FIELD_LABELS } from "@/lib/candidate-fields";

export const Route = createFileRoute("/_app/integrations")({ component: Page });

function Page() {
  const { user, profile, role, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Checking integration access…</p>;
  if (!canReadPrivateUserDirectory(user?.id, profile, role))
    return <p className="text-sm text-muted-foreground">Approved administrator access is required.</p>;
  // The separate workspace is only mounted after a verified admin.
  // Switching accounts removes private React Query hooks and local state.
  return <AdminIntegrationWorkspace key={user!.id + ":" + role} userId={user!.id} />;
}

function AdminIntegrationWorkspace({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchIntegration = useServerFn(getIntegration);
  const save = useServerFn(saveIntegration);
  const detect = useServerFn(detectHeaders);
  const sync = useServerFn(triggerSync);
  const fetchLogs = useServerFn(getSyncLogs);

  const integQ = useQuery({ queryKey: ["integration", userId], queryFn: () => fetchIntegration() });
  const logsQ = useQuery({ queryKey: ["sync-logs", userId], queryFn: () => fetchLogs() });

  const [form, setForm] = useState({ sheet_url: "", sheet_name: "Form Responses 1", header_row: 1, auto_sync_enabled: false, sync_frequency_minutes: 2 });
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<any>(null);

  const integration = integQ.data?.integration ?? null;
  const diagnostics = runtimeDiagnostics ?? integQ.data?.diagnostics ?? {
    settingsLoaded: false,
    spreadsheetFound: false,
    tabFound: false,
    headersFound: false,
    rowsFetched: 0,
  };

  useEffect(() => {
    if (integration) {
      setForm({
        sheet_url: integration.sheet_url ?? "",
        sheet_name: integration.sheet_name ?? "Form Responses 1",
        header_row: integration.header_row ?? 1,
        auto_sync_enabled: !!integration.auto_sync_enabled,
        sync_frequency_minutes: integration.sync_frequency_minutes ?? 2,
      });
      setMapping((integration.column_mapping as any) ?? {});
    }
  }, [integration]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)
        throw new Error(CRM_INTEGRATION_MUTATION_HOLD_REASON);
      return save({ data: { ...form, column_mapping: mapping } });
    },
    onSuccess: (row: any) => {
      if (!row?.integration?.id) {
        toast.error("Save failed: no integration settings were returned by the server");
        console.error("Google integration save failed");
        return;
      }
      // Never log private Sheets URLs, row IDs, account data or diagnostics.
      toast.success("Integration settings saved");
      setRuntimeDiagnostics(row?.diagnostics ?? null);
      qc.setQueryData(["integration", userId], row);
      qc.invalidateQueries({ queryKey: ["integration", userId] });
    },
    onError: () => { console.error("Google integration save failed"); toast.error("Integration settings unavailable"); },
  });

  const ensureSaved = async () => {
    const cur = integration;
    const dirty = !cur || cur.sheet_url !== (form.sheet_url || null) || cur.sheet_name !== form.sheet_name
      || cur.header_row !== form.header_row || !!cur.auto_sync_enabled !== form.auto_sync_enabled
      || cur.sync_frequency_minutes !== form.sync_frequency_minutes;
    if (dirty) await saveMut.mutateAsync();
  };

  const detectMut = useMutation({
    mutationFn: async () => {
      if (CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)
        throw new Error(CRM_INTEGRATION_MUTATION_HOLD_REASON);
      await ensureSaved();
      return detect({ data: {} });
    },
    onSuccess: (r: any) => { const hs = Array.isArray(r?.headers) ? r.headers : []; setHeaders(hs); setMapping((m) => ({ ...(r?.suggested ?? {}), ...m })); setRuntimeDiagnostics(r?.diagnostics ?? null); toast.success(`Detected ${hs.length} columns`); },
    onError: () => toast.error("Header detection unavailable"),
  });

  const syncMut = useMutation({
    mutationFn: async (full: boolean) => {
      if (CRM_CANDIDATE_SYNC_MUTATIONS_PAUSED ||
          CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED)
        throw new Error(CRM_INTEGRATION_MUTATION_HOLD_REASON);
      await ensureSaved();
      return sync({ data: { fullHistory: full } });
    },
    onSuccess: (r) => {
      const created = Number(r?.created ?? r?.rows_created ?? 0);
      const updated = Number(r?.updated ?? r?.rows_updated ?? 0);
      const skipped = Number(r?.skipped ?? r?.rows_skipped ?? 0);
      const errors = Number(r?.errors ?? (Array.isArray(r?.error_details) ? r.error_details.length : 0));
      setRuntimeDiagnostics(r?.diagnostics ?? null);
      toast.success(`Sync Complete\nCreated: ${created}\nUpdated: ${updated}\nSkipped: ${skipped}\nErrors: ${errors}`);
      qc.invalidateQueries({ queryKey: ["integration", userId] }); qc.invalidateQueries({ queryKey: ["sync-logs", userId] });
    },
    onError: () => toast.error("Candidate synchronization unavailable; check restricted logs"),
  });

  const hasValidUrl = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.test(form.sheet_url || "");
  const canSync = hasValidUrl || !!integration?.spreadsheet_id;

  const status = integration?.connection_status;
  const statusVariant: any = status === "success" ? "default" : status === "partial" || status === "configured" || status === "headers_detected" ? "secondary" : status === "error" ? "destructive" : "outline";

  const mappedHeaders = useMemo(() => headers.length ? headers : Object.keys(mapping ?? {}), [headers, mapping]);
  const logs = Array.isArray(logsQ.data) ? logsQ.data : [];
  const diagnosticItems = [
    ["Logged user id", diagnostics.loggedUserId ?? "—"],
    ["Settings row found", diagnostics.settingsRowFound ? "YES" : "NO"],
    ["Settings row id", diagnostics.settingsRowId ? String(diagnostics.settingsRowId).slice(0, 8) : "—"],
    ["Sheet URL", diagnostics.fetchedSheetUrl ? "Configured (link withheld)" : "Unavailable"],
    ["Save success", diagnostics.saveSuccess === undefined ? "—" : diagnostics.saveSuccess ? "YES" : "NO"],
    ["Settings loaded", diagnostics.settingsLoaded ? "YES" : "NO"],
    ["Spreadsheet found", diagnostics.spreadsheetFound ? "YES" : "NO"],
    ["Tab found", diagnostics.tabFound ? "YES" : "NO"],
    ["Headers found", diagnostics.headersFound ? "YES" : "NO"],
    ["Rows fetched", String(diagnostics.rowsFetched ?? 0)],
  ];

  if (integQ.isError) {
    // surface error but don't crash
    console.error("Integration settings unavailable");
  }
  if (logsQ.isError) {
    console.error("Sync log history unavailable");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Google Sheets settings, header detection and candidate synchronization are read-only pending independent approval. Historical diagnostics are redacted.</p>
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
              <Input disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={form.sheet_url} onChange={(e) => setForm({ ...form, sheet_url: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"/>
            </div>
            <div className="space-y-2">
              <Label>Sheet (tab) name</Label>
              <Input disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={form.sheet_name} onChange={(e) => setForm({ ...form, sheet_name: e.target.value })}/>
            </div>
            <div className="space-y-2">
              <Label>Header row</Label>
              <Input disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} type="number" min={1} value={form.header_row}
                onChange={(e) => setForm({ ...form, header_row: Number(e.target.value) || 1 })}/>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.auto_sync_enabled} disabled title="Scheduled sync remains inactive until release approval" />
                <Label>Auto sync (every 2 min)</Label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => detectMut.mutate()} disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED || !canSync || detectMut.isPending}>
              {detectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>} Detect columns
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin"/>} Save settings
            </Button>
            <Button variant="secondary" disabled title="Manual candidate sync requires release approval and an assigned recruiter">
              <RefreshCw className="h-4 w-4"/> Sync new rows (paused)
            </Button>
            <Button variant="outline" disabled title="Full-history import requires reconciliation of the source-row ledger">
              <History className="h-4 w-4"/> Full history (paused)
            </Button>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5">
            {diagnosticItems.map(([label, value]) => (
              <div key={label} className="space-y-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold break-words">{value}</div>
              </div>
            ))}
          </div>

          {mappedHeaders.length > 0 && (
            <div className="space-y-2">
              <Label>Column mapping (Sheet → CRM field)</Label>
              <div className="border rounded-lg divide-y">
                {mappedHeaders.map((h) => (
                  <div key={h} className="grid grid-cols-2 gap-3 p-3 items-center">
                    <div className="text-sm font-medium truncate">{h}</div>
                    <Select disabled={CRM_INTEGRATION_CONFIGURATION_MUTATIONS_PAUSED} value={mapping[h] ?? "__none"} onValueChange={(v) => {
                      const next = { ...mapping }; if (v === "__none") delete next[h]; else next[h] = v; setMapping(next);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Ignore"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Ignore —</SelectItem>
                        {CANDIDATE_FIELDS.map((f) => <SelectItem key={f} value={f}>{CANDIDATE_FIELD_LABELS[f]}</SelectItem>)}
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
          <CardContent className="text-sm">{integration?.last_sync ? new Date(integration.last_sync).toLocaleString() : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Last synced row</CardTitle></CardHeader>
          <CardContent className="text-sm">{integration?.last_synced_row ?? 1}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div><CardTitle>Sync history</CardTitle><CardDescription>Most recent 50 runs. Refresh manually; no background polling.</CardDescription></div>
          <Button type="button" variant="outline" size="sm" disabled={logsQ.isFetching}
            onClick={() => { void logsQ.refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh history
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead>
              <TableHead>Created</TableHead><TableHead>Updated</TableHead><TableHead>Skipped</TableHead><TableHead>Errors</TableHead><TableHead>Failure Reason</TableHead>
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
                  <TableCell>{Array.isArray(l.errors) ? l.errors.length : 0}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {Array.isArray(l.errors) && l.errors.length ? "Failure details withheld pending privacy review" : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No sync runs yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
