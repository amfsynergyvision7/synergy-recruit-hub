import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_BULK_IMPORT_WRITES_PAUSED, BULK_IMPORT_HOLD_REASON } from "@/lib/release-safety";
import { commitCandidateImport } from "@/lib/candidate-batch-import";
import { IMPORT_SCHEMAS, type ImportSchema, type ImportFieldDef } from "@/lib/import-schemas";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/import")({ component: Page });

type Step = "upload" | "map" | "preview" | "result";
type RowError = { row: number; field?: string; message: string };
type MappedRow = { data: Record<string, any>; errors: RowError[]; isDuplicate: boolean; rowIndex: number };

function downloadTemplate(schema: ImportSchema, fmt: "xlsx" | "csv") {
  const headers = schema.fields.map((f) => f.name);
  const example: Record<string, any> = {};
  schema.fields.forEach((f) => {
    example[f.name] = f.enum?.[0] ?? (f.type === "number" ? 0 : f.type === "date" ? "2025-01-01" : "");
  });
  if (fmt === "csv") {
    const csv = Papa.unparse([example], { columns: headers });
    const blob = new Blob([csv], { type: "text/csv" });
    triggerDownload(blob, `${schema.key}_template.csv`);
  } else {
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, schema.label.slice(0, 30));
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    triggerDownload(new Blob([out]), `${schema.key}_template.xlsx`);
  }
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => resolve({ headers: res.meta.fields ?? [], rows: res.data as any[] }),
        error: reject,
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, rows: json };
}

function autoMap(fileHeaders: string[], schema: ImportSchema): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  schema.fields.forEach((f) => {
    const target = norm(f.name);
    const targetLabel = norm(f.label);
    const found = fileHeaders.find((h) => {
      const n = norm(h);
      return n === target || n === targetLabel;
    });
    if (found) map[f.name] = found;
  });
  return map;
}

function coerce(value: any, field: ImportFieldDef): { value: any; error?: string } {
  if (value === "" || value == null) {
    if (field.required) return { value: null, error: "Required" };
    return { value: null };
  }
  const s = String(value).trim();
  if (field.type === "number") {
    const n = Number(s);
    if (isNaN(n)) return { value: null, error: "Not a number" };
    return { value: n };
  }
  if (field.type === "date") {
    if (typeof value === "number") {
      const d = XLSX.SSF.parse_date_code(value);
      if (d) return { value: `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}` };
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return { value: null, error: "Invalid date" };
    return { value: d.toISOString().slice(0, 10) };
  }
  if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(s)) return { value: s, error: "Invalid email" };
  if (field.enum && !field.enum.includes(s)) return { value: null, error: `Must be one of: ${field.enum.join(", ")}` };
  return { value: s };
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refMap(rows: any[], keys: string[]) {
  const map = new Map<string, string>();
  rows.forEach((row) => keys.forEach((key) => row[key] && map.set(String(row[key]).trim().toLowerCase(), row.id)));
  return map;
}

function Page() {
  const { role } = useAuth();
  const [moduleKey, setModuleKey] = useState<string>("clients");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [updateExisting, setUpdateExisting] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [assignedRecruiter, setAssignedRecruiter] = useState("");
  const [approvedRecruiters, setApprovedRecruiters] = useState<{ id: string; label: string }[]>([]);
  // An uncertain network result is retried with the SAME request ID and payload.
  // A different file must use a deliberate reset before getting a new ID.
  const importRequestId = useRef<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const schema = IMPORT_SCHEMAS[moduleKey];

  useEffect(() => {
    // Selection is only UX. The RPC must independently check the assignee's
    // approved, active recruiter role from the live database.
    let current = true;
    Promise.all([
      supabase.from("user_roles").select("user_id,role").eq("role", "recruiter"),
      supabase.from("profiles").select("id,full_name,email").eq("status", "approved").eq("is_active", true),
    ]).then(([roleRes, profileRes]) => {
      if (!current || roleRes.error || profileRes.error) return;
      const recruiterIds = new Set((roleRes.data ?? []).map((r) => r.user_id));
      setApprovedRecruiters((profileRes.data ?? [])
        .filter((p) => recruiterIds.has(p.id))
        .map((p) => ({ id: p.id, label: p.full_name || p.email })));
    }).catch(() => { /* Fail closed: no assignee can be selected. */ });
    return () => { current = false; };
  }, []);

  if (role !== "admin") {
    return (
      <div className="max-w-2xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Admin only</AlertTitle>
          <AlertDescription>Bulk data import is restricted to administrators.</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4"><Link to="/settings"><ArrowLeft className="h-4 w-4 mr-2"/>Back to Settings</Link></Button>
      </div>
    );
  }

  const reset = () => {
    setStep("upload"); setFile(null); setFileHeaders([]); setRawRows([]);
    setMapping({}); setMappedRows([]); setExistingKeys(new Set()); setProgress(0); setResult(null);
    setAssignedRecruiter(""); importRequestId.current = null;
  };

  const onFile = async (f: File) => {
    setFile(f);
    importRequestId.current = null;
    try {
      const { headers, rows } = await parseFile(f);
      if (!rows.length) { toast.error("No rows found in file"); return; }
      setFileHeaders(headers);
      setRawRows(rows);
      setMapping(autoMap(headers, schema));
      setStep("map");
    } catch (e: any) {
      toast.error("Parse failed: " + e.message);
    }
  };

  const buildPreview = async () => {
    // Validate required mappings
    const missing = schema.fields.filter((f) => f.required && !mapping[f.name]).map((f) => f.label);
    if (missing.length) { toast.error("Map required fields: " + missing.join(", ")); return; }

    // Fetch existing unique keys for duplicate detection
    const { data: existing } = await supabase.from(schema.table as any).select(schema.uniqueField);
    const keys = new Set<string>((existing ?? []).map((r: any) => String(r[schema.uniqueField] ?? "").toLowerCase()).filter(Boolean));
    setExistingKeys(keys);

    const [{ data: candidateRefs }, { data: clientRefs }, { data: jobRefs }] = await Promise.all([
      supabase.from("candidates" as any).select("id,candidate_code,email,full_name"),
      supabase.from("clients" as any).select("id,company_name,email"),
      supabase.from("job_openings" as any).select("id,job_title"),
    ]);
    const candidates = refMap(candidateRefs ?? [], ["id", "candidate_code", "email", "full_name"]);
    const clients = refMap(clientRefs ?? [], ["id", "company_name", "email"]);
    const jobs = refMap(jobRefs ?? [], ["id", "job_title"]);

    const resolveRef = (value: any, map: Map<string, string>) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      if (uuidRe.test(raw)) return raw;
      return map.get(raw.toLowerCase()) ?? null;
    };

    const out: MappedRow[] = rawRows.map((raw, i) => {
      const data: Record<string, any> = {};
      const errors: RowError[] = [];
      schema.fields.forEach((f) => {
        const src = mapping[f.name];
        const val = src ? raw[src] : undefined;
        const { value, error } = coerce(val, f);
        if (error) errors.push({ row: i + 2, field: f.name, message: `${f.label}: ${error}` });
        if (value !== null && value !== undefined && value !== "") data[f.name] = value;
      });
      if (moduleKey !== "candidates" && data.candidate_id) {
        const id = resolveRef(data.candidate_id, candidates);
        if (id) { data.candidate_uuid = id; data.candidate_id = id; }
        else errors.push({ row: i + 2, field: "candidate_id", message: `Candidate not found: ${data.candidate_id}` });
      }
      if (["jobs", "submissions", "interviews", "offers", "billing"].includes(moduleKey) && data.client_id) {
        const id = resolveRef(data.client_id, clients);
        if (id) { data.client_uuid = id; data.client_id = id; }
        else errors.push({ row: i + 2, field: "client_id", message: `Client not found: ${data.client_id}` });
      }
      if (moduleKey === "submissions" && data.job_id) {
        const id = resolveRef(data.job_id, jobs);
        if (id) { data.job_uuid = id; data.job_id = id; }
        else errors.push({ row: i + 2, field: "job_id", message: `Job not found: ${data.job_id}` });
      }
      const keyVal = String(data[schema.uniqueField] ?? "").toLowerCase();
      const isDuplicate = !!keyVal && keys.has(keyVal);
      return { data, errors, isDuplicate, rowIndex: i + 2 };
    });
    setMappedRows(out);
    setStep("preview");
  };

  // Build53: candidate create-only import has a single audited SQL transaction.
  // The unconditional release hold remains ON, including this future RPC.
  const runImport = async () => {
    if (LEGACY_BULK_IMPORT_WRITES_PAUSED) {
      toast.error(BULK_IMPORT_HOLD_REASON);
      return;
    }
    if (moduleKey !== "candidates") {
      toast.error("Other module imports require independently reviewed server write commands.");
      return;
    }
    if (!assignedRecruiter || mappedRows.length === 0 || mappedRows.length > 50) {
      toast.error("Select an approved recruiter and use a batch of 1–50 rows.");
      return;
    }
    if (updateExisting || skipInvalid || mappedRows.some((r) => r.errors.length || r.isDuplicate)) {
      toast.error("Candidate import is create-only and atomic: do not update, skip or import invalid/duplicate rows.");
      return;
    }
    if (mappedRows.some((r) => r.data.stage && r.data.stage !== "lead_received")) {
      toast.error("Imported candidates must start at lead_received; stage automation is not authorized.");
      return;
    }
    const rows = mappedRows.map((r) => {
      const { stage: _initialStage, ...ordinaryFields } = r.data;
      return ordinaryFields;
    });
    if (!importRequestId.current) importRequestId.current = crypto.randomUUID();
    setRunning(true); setProgress(0); setResult(null);
    try {
      const { data, error } = await commitCandidateImport({
        requestId: importRequestId.current,
        assignedRecruiter,
        rows,
      });
      if (error || !data) {
        toast.error(error?.message || "Import result not confirmed; retry using the same request ID.");
        return;
      }
      setProgress(100);
      setResult({
        created: data.status === "created" ? data.count : 0,
        updated: 0,
        skipped: data.status === "replayed" ? data.count : 0,
        errors: [],
      });
      setStep("result");
      toast.success(data.status === "replayed" ? "Previously committed batch confirmed" : "Atomic candidate batch committed");
    } finally {
      setRunning(false);
    }
  };

  const validCount = useMemo(() => mappedRows.filter((r) => r.errors.length === 0).length, [mappedRows]);
  const errorCount = mappedRows.length - validCount;
  const duplicateCount = useMemo(() => mappedRows.filter((r) => r.isDuplicate).length, [mappedRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Data Import</h1>
          <p className="text-sm text-muted-foreground">Excel/CSV review and mapping only. No database imports are enabled.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/settings"><ArrowLeft className="h-4 w-4 mr-2"/>Settings</Link></Button>
      </div>

      {LEGACY_BULK_IMPORT_WRITES_PAUSED && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Import writes paused</AlertTitle>
          <AlertDescription>{BULK_IMPORT_HOLD_REASON}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>1. Choose Module</CardTitle>
          <CardDescription>Select what kind of data you want to import.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={moduleKey} onValueChange={(v) => { setModuleKey(v); reset(); setUpdateExisting(v !== "candidates"); setSkipInvalid(v !== "candidates"); }}>
            <TabsList className="flex flex-wrap h-auto">
              {Object.values(IMPORT_SCHEMAS).map((s) => (
                <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
            {Object.values(IMPORT_SCHEMAS).map((s) => (
              <TabsContent key={s.key} value={s.key} className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-2">Sample template:</span>
                  <Button size="sm" variant="outline" onClick={() => downloadTemplate(s, "xlsx")}>
                    <Download className="h-4 w-4 mr-2"/>Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadTemplate(s, "csv")}>
                    <Download className="h-4 w-4 mr-2"/>CSV
                  </Button>
                  <Badge variant="secondary" className="ml-auto">Match key: {s.uniqueField}</Badge>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>2. Upload File</CardTitle>
            <CardDescription>Supported: .xlsx, .csv</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-8 cursor-pointer hover:bg-accent">
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Click to choose a file</span>
              <span className="text-xs text-muted-foreground mt-1">or drop in your spreadsheet</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>3. Map Columns</CardTitle>
            <CardDescription>
              <FileSpreadsheet className="inline h-4 w-4 mr-1"/>{file?.name} — {rawRows.length} rows. Auto-detected mappings shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {schema.fields.map((f) => (
              <div key={f.name} className="grid grid-cols-2 gap-3 items-center">
                <Label>
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                  <span className="text-xs text-muted-foreground ml-2">({f.name})</span>
                </Label>
                <Select value={mapping[f.name] ?? "__none__"} onValueChange={(v) => setMapping({ ...mapping, [f.name]: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="— skip —"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— skip —</SelectItem>
                    {fileHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={buildPreview}>Preview Import</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>4. Preview</CardTitle>
            <CardDescription>{moduleKey === "candidates" ? "Create-only preview; all 1–50 rows must be valid. No stage changes or existing-record updates." : "Review before importing. Writes remain paused."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total: {mappedRows.length}</Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Valid: {validCount}</Badge>
              <Badge variant="destructive">Errors: {errorCount}</Badge>
              <Badge variant="outline">Duplicates: {duplicateCount}</Badge>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={updateExisting} disabled={moduleKey === "candidates"} onCheckedChange={(v) => setUpdateExisting(!!v)} />
                Update existing records (matched by {schema.uniqueField})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={skipInvalid} disabled={moduleKey === "candidates"} onCheckedChange={(v) => setSkipInvalid(!!v)} />
                Skip invalid rows
              </label>
            </div>

            {moduleKey === "candidates" && (
              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="import-recruiter">Approved recruiter to receive every new candidate</Label>
                <Select value={assignedRecruiter} onValueChange={setAssignedRecruiter}>
                  <SelectTrigger id="import-recruiter"><SelectValue placeholder="Choose an approved recruiter" /></SelectTrigger>
                  <SelectContent>
                    {approvedRecruiters.map((r) =>
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Atomic create-only import: maximum 50 rows, no partial success, no duplicate updates.
                  Backend checks all rows and recruiter status again before writing. Import remains paused until release approval.
                </p>
              </div>
            )}
            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    {schema.fields.slice(0, 5).map((f) => <TableHead key={f.name}>{f.label}</TableHead>)}
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.slice(0, 100).map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell>{r.rowIndex}</TableCell>
                      <TableCell>
                        {r.errors.length ? <Badge variant="destructive">Invalid</Badge>
                          : r.isDuplicate ? <Badge variant="outline">Duplicate</Badge>
                          : <Badge className="bg-emerald-600 hover:bg-emerald-600">New</Badge>}
                      </TableCell>
                      {schema.fields.slice(0, 5).map((f) => (
                        <TableCell key={f.name} className="max-w-[180px] truncate">{String(r.data[f.name] ?? "")}</TableCell>
                      ))}
                      <TableCell className="text-xs text-destructive">{r.errors.map((e) => e.message).join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {mappedRows.length > 100 && <div className="p-2 text-xs text-muted-foreground text-center">Showing first 100 of {mappedRows.length}</div>}
            </div>

            {running && <Progress value={progress} />}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")} disabled={running}>Back</Button>
              <Button onClick={runImport} disabled={running || LEGACY_BULK_IMPORT_WRITES_PAUSED}>
                {LEGACY_BULK_IMPORT_WRITES_PAUSED ? "Import paused" : running ? `Importing… ${progress}%` : "Start Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "result" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600"/>Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Created: {result.created}</Badge>
              <Badge className="bg-blue-600 hover:bg-blue-600">Updated: {result.updated}</Badge>
              <Badge variant="outline">Skipped: {result.skipped}</Badge>
            </div>
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{result.errors.length} error(s)</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 max-h-48 overflow-auto text-xs">
                    {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={reset}>Import Another File</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
