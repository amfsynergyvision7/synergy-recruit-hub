// Zoho gap this closes: "Reporting/export" — the Dashboard already has fixed
// KPIs and charts (recharts, all-time or this-month snapshots), but there was
// nowhere to slice the pipeline by a custom date range and get an exportable
// table out of it. This page is deliberately tabular and date-scoped rather
// than another set of charts, and every table has its own "Export CSV"
// button (src/lib/csv.ts — the same helper CrudModule's per-module export
// uses), so a recruiter or finance user can pull exactly the slice they need
// (say, last quarter's placements) straight into Excel.
//
// Data model: like Dashboard's existing `candAll`/`bills` fetches, this pulls
// each table's relevant columns in full (unfiltered) and does the date-range
// filtering + aggregation client-side. That's a deliberate match to the
// established pattern here, not a shortcut — recruiter/client attribution
// for a submission or offer requires looking up the *candidate's*
// assigned_recruiter, and an interview or offer can easily reference a
// candidate added well before the report's date window, so the candidate ->
// recruiter map has to come from the whole table regardless of which window
// is selected. At this app's free-tier/prototype scale that's a handful of
// small selects, not a performance concern.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Inbox } from "lucide-react";
import { rowsToCsv, downloadCsv, todayStamp } from "@/lib/csv";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

const STAGE_ORDER = [
  "lead_received", "contacted", "interested", "resume_collected", "submitted_to_client",
  "interview_scheduled", "interview_completed", "selected", "offer_released", "joined",
  "rejected", "dropped",
];

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Whether an ISO timestamp falls within [from, to] — both plain
 * "YYYY-MM-DD" strings interpreted as local-time day boundaries, the same
 * local-time-safe approach scheduling.ts uses for slot handling, so a report
 * for "today" actually means the recruiter's own today rather than shifting
 * by whatever timezone the server happens to run in. */
function inRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const fromT = new Date(`${from}T00:00:00`).getTime();
  const toT = new Date(`${to}T23:59:59.999`).getTime();
  return t >= fromT && t <= toT;
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function recruiterLabel(id: string | null, names: Record<string, string>): string {
  if (!id) return "Unassigned";
  return names[id] ?? `${id.slice(0, 6)}…`;
}

interface ReportTableProps {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number)[][];
  filenamePrefix: string;
  loading: boolean;
  emptyLabel: string;
}

function ReportTable({ title, description, headers, rows, filenamePrefix, loading, emptyLabel }: ReportTableProps) {
  const exportCsv = () => {
    const csv = rowsToCsv(headers, rows);
    downloadCsv(`${filenamePrefix}-${todayStamp()}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-8">
            <Inbox className="h-6 w-6 opacity-50" />
            <div className="text-xs">{emptyLabel}</div>
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Reports() {
  const [from, setFrom] = useState(() => isoDateNDaysAgo(30));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["reports-data"],
    queryFn: async () => {
      const [
        { data: candidates },
        { data: submissions },
        { data: interviews },
        { data: offers },
        { data: clients },
        { data: billing },
        { data: profiles },
      ] = await Promise.all([
        supabase.from("candidates").select("id, stage, assigned_recruiter, created_at"),
        supabase.from("submissions").select("id, candidate_uuid, candidate_id, client_uuid, client_id, created_at"),
        supabase.from("interviews").select("id, candidate_uuid, candidate_id, client_uuid, client_id, status, created_at"),
        supabase.from("offers").select("id, candidate_uuid, candidate_id, client_uuid, client_id, offer_status, joining_status, ctc, salary, created_at"),
        supabase.from("clients").select("id, company_name, active_positions"),
        supabase.from("billing").select("id, client_uuid, client_id, invoice_amount, outstanding_amount, payment_status, invoice_date"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        candidates: candidates ?? [], submissions: submissions ?? [], interviews: interviews ?? [],
        offers: offers ?? [], clients: clients ?? [], billing: billing ?? [], profiles: profiles ?? [],
      };
    },
    staleTime: 60_000,
  });

  const candidates = data?.candidates ?? [];
  const submissions = data?.submissions ?? [];
  const interviews = data?.interviews ?? [];
  const offers = data?.offers ?? [];
  const clients = data?.clients ?? [];
  const billing = data?.billing ?? [];

  const recruiterNames = useMemo(() => {
    const m: Record<string, string> = {};
    (data?.profiles ?? []).forEach((p: any) => { m[p.id] = p.full_name; });
    return m;
  }, [data?.profiles]);

  // Candidate id -> assigned recruiter, built from the WHOLE candidates
  // table (not the date-filtered slice below) — see the file-level note on
  // why an in-range submission/interview/offer can point at a candidate
  // added outside the window.
  const recruiterOfCandidate = useMemo(() => {
    const m: Record<string, string | null> = {};
    candidates.forEach((c: any) => { m[c.id] = c.assigned_recruiter; });
    return m;
  }, [candidates]);

  const clientNames = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach((c: any) => { m[c.id] = c.company_name; });
    return m;
  }, [clients]);

  const candidatesInRange = useMemo(() => candidates.filter((c: any) => inRange(c.created_at, from, to)), [candidates, from, to]);
  const submissionsInRange = useMemo(() => submissions.filter((s: any) => inRange(s.created_at, from, to)), [submissions, from, to]);
  const interviewsInRange = useMemo(() => interviews.filter((i: any) => inRange(i.created_at, from, to)), [interviews, from, to]);
  const offersInRange = useMemo(() => offers.filter((o: any) => inRange(o.created_at, from, to)), [offers, from, to]);
  const billingInRange = useMemo(() => billing.filter((b: any) => inRange(b.invoice_date, from, to)), [billing, from, to]);

  // --- Report 1: Candidate pipeline by stage ---
  const pipelineRows = useMemo(() => {
    const counts: Record<string, number> = {};
    candidatesInRange.forEach((c: any) => { counts[c.stage] = (counts[c.stage] ?? 0) + 1; });
    const total = candidatesInRange.length;
    return STAGE_ORDER
      .filter((s) => counts[s] > 0)
      .map((s) => [
        s.replace(/_/g, " "),
        counts[s],
        total > 0 ? `${Math.round((counts[s] / total) * 100)}%` : "0%",
      ] as (string | number)[]);
  }, [candidatesInRange]);

  // --- Report 2: Recruiter performance ---
  const recruiterRows = useMemo(() => {
    const rec: Record<string, { added: number; submissions: number; interviews: number; offers: number; joined: number }> = {};
    const ensure = (id: string) => (rec[id] ??= { added: 0, submissions: 0, interviews: 0, offers: 0, joined: 0 });

    candidatesInRange.forEach((c: any) => { if (c.assigned_recruiter) ensure(c.assigned_recruiter).added++; });
    submissionsInRange.forEach((s: any) => {
      const rid = recruiterOfCandidate[s.candidate_uuid ?? s.candidate_id];
      if (rid) ensure(rid).submissions++;
    });
    interviewsInRange.forEach((i: any) => {
      const rid = recruiterOfCandidate[i.candidate_uuid ?? i.candidate_id];
      if (rid) ensure(rid).interviews++;
    });
    offersInRange.forEach((o: any) => {
      const rid = recruiterOfCandidate[o.candidate_uuid ?? o.candidate_id];
      if (!rid) return;
      ensure(rid).offers++;
      if (o.joining_status === "joined") ensure(rid).joined++;
    });

    return Object.entries(rec)
      .sort((a, b) => b[1].added - a[1].added)
      .map(([id, v]) => [recruiterLabel(id, recruiterNames), v.added, v.submissions, v.interviews, v.offers, v.joined] as (string | number)[]);
  }, [candidatesInRange, submissionsInRange, interviewsInRange, offersInRange, recruiterOfCandidate, recruiterNames]);

  // --- Report 3: Client-wise pipeline summary ---
  const clientRows = useMemo(() => {
    const byClient: Record<string, { submissions: number; interviews: number; offers: number; joined: number }> = {};
    const ensure = (id: string) => (byClient[id] ??= { submissions: 0, interviews: 0, offers: 0, joined: 0 });

    submissionsInRange.forEach((s: any) => { const cid = s.client_uuid ?? s.client_id; if (cid) ensure(cid).submissions++; });
    interviewsInRange.forEach((i: any) => { const cid = i.client_uuid ?? i.client_id; if (cid) ensure(cid).interviews++; });
    offersInRange.forEach((o: any) => {
      const cid = o.client_uuid ?? o.client_id;
      if (!cid) return;
      ensure(cid).offers++;
      if (o.joining_status === "joined") ensure(cid).joined++;
    });

    return Object.entries(byClient)
      .sort((a, b) => (b[1].submissions + b[1].interviews + b[1].offers) - (a[1].submissions + a[1].interviews + a[1].offers))
      .map(([id, v]) => [
        clientNames[id] ?? `${id.slice(0, 6)}…`,
        v.submissions, v.interviews, v.offers, v.joined,
      ] as (string | number)[]);
  }, [submissionsInRange, interviewsInRange, offersInRange, clientNames]);

  // --- Report 4: Billing summary by client ---
  const billingRows = useMemo(() => {
    const byClient: Record<string, { invoiced: number; collected: number; outstanding: number }> = {};
    const ensure = (id: string) => (byClient[id] ??= { invoiced: 0, collected: 0, outstanding: 0 });

    billingInRange.forEach((b: any) => {
      const cid = b.client_uuid ?? b.client_id;
      if (!cid) return;
      const row = ensure(cid);
      row.invoiced += Number(b.invoice_amount ?? 0);
      if (b.payment_status === "paid") row.collected += Number(b.invoice_amount ?? 0);
      row.outstanding += Number(b.outstanding_amount ?? 0);
    });

    return Object.entries(byClient)
      .sort((a, b) => b[1].invoiced - a[1].invoiced)
      .map(([id, v]) => [
        clientNames[id] ?? `${id.slice(0, 6)}…`,
        fmtCurrency(v.invoiced), fmtCurrency(v.collected), fmtCurrency(v.outstanding),
      ] as (string | number)[]);
  }, [billingInRange, clientNames]);

  const applyPreset = (days: number) => { setFrom(isoDateNDaysAgo(days)); setTo(new Date().toISOString().slice(0, 10)); };
  const applyAllTime = () => { setFrom("2000-01-01"); setTo(new Date().toISOString().slice(0, 10)); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Date-ranged, exportable pipeline and billing reports — pick a window below, every table exports to CSV.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => applyPreset(7)}>Last 7 days</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset(30)}>Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset(90)}>Last 90 days</Button>
            <Button variant="outline" size="sm" onClick={applyAllTime}>All time</Button>
          </div>
        </CardContent>
      </Card>

      <ReportTable
        title="Candidate Pipeline by Stage"
        description="Candidates added in the selected window, grouped by their current stage."
        headers={["Stage", "Count", "Share"]}
        rows={pipelineRows}
        filenamePrefix="pipeline-by-stage"
        loading={isLoading}
        emptyLabel="No candidates added in this window."
      />

      <ReportTable
        title="Recruiter Performance"
        description="Activity attributed to each recruiter's assigned candidates within the window."
        headers={["Recruiter", "Candidates Added", "Submissions", "Interviews", "Offers", "Joined"]}
        rows={recruiterRows}
        filenamePrefix="recruiter-performance"
        loading={isLoading}
        emptyLabel="No recruiter activity in this window."
      />

      <ReportTable
        title="Client-wise Pipeline Summary"
        description="Submissions, interviews, and outcomes per client within the window."
        headers={["Client", "Submissions", "Interviews", "Offers", "Joined"]}
        rows={clientRows}
        filenamePrefix="client-pipeline-summary"
        loading={isLoading}
        emptyLabel="No client activity in this window."
      />

      <ReportTable
        title="Billing Summary by Client"
        description="Invoiced, collected, and outstanding amounts, by invoice date within the window."
        headers={["Client", "Invoiced", "Collected", "Outstanding"]}
        rows={billingRows}
        filenamePrefix="billing-summary"
        loading={isLoading}
        emptyLabel="No invoices in this window."
      />
    </div>
  );
}