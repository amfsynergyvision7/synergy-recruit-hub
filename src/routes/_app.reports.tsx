// Build124: Only return role-permitted, count-complete and bounded source data.
// Rejected/partial pages are never turned into a zero-valued KPI or CSV export.
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
import { useAuth } from "@/hooks/use-auth";
import { canReadPipelineReports } from "@/lib/crm-report-access";
import { readBoundedReportRows } from "@/lib/bounded-report-read";

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

function recruiterLabel(id: string | null): string {
  return id ? `Recruiter ${id.slice(0, 8)}…` : "Unassigned";
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
  const { user, profile, role } = useAuth();
  const allowed = canReadPipelineReports(user?.id, profile, role);
  const [from, setFrom] = useState(() => isoDateNDaysAgo(30));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports-data", user?.id ?? "signed-out", role ?? "none"],
    enabled: allowed,
    queryFn: async ({ signal }) => {
      if (!allowed) throw new Error("Reporting requires an approved account and role");
      // The PostgREST default row limit is not proof that all matching rows
      // were fetched. Each authorized table is read with a count, ordered
      // by unique ID, in bounded explicit pages. Failure is NOT "zero".
      try {
        const [candidates, submissions, interviews, offers, clients] = await Promise.all([
          readBoundedReportRows((from, to, abort) =>
            supabase.from("candidates")
              .select("id, stage, assigned_recruiter, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          readBoundedReportRows((from, to, abort) =>
            supabase.from("submissions")
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          readBoundedReportRows((from, to, abort) =>
            supabase.from("interviews")
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, status, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          readBoundedReportRows((from, to, abort) =>
            supabase.from("offers")
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, offer_status, joining_status, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          readBoundedReportRows((from, to, abort) =>
            supabase.from("clients")
              .select("id, company_name", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
        ]);
        return { candidates, submissions, interviews, offers, clients };
      } catch {
        // Avoid exposing a raw database error or silently computing on
        // inconsistent/missing pages. Server-side RLS is still authoritative.
        throw new Error("Unable to retrieve authorized reporting data");
      }
    },
    staleTime: 60_000,
  });

  const candidates = data?.candidates ?? [];
  const submissions = data?.submissions ?? [];
  const interviews = data?.interviews ?? [];
  const offers = data?.offers ?? [];
  const clients = data?.clients ?? [];

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
      .map(([id, v]) => [recruiterLabel(id), v.added, v.submissions, v.interviews, v.offers, v.joined] as (string | number)[]);
  }, [candidatesInRange, submissionsInRange, interviewsInRange, offersInRange, recruiterOfCandidate]);

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

  const applyPreset = (days: number) => { setFrom(isoDateNDaysAgo(days)); setTo(new Date().toISOString().slice(0, 10)); };
  const applyAllTime = () => { setFrom("2000-01-01"); setTo(new Date().toISOString().slice(0, 10)); };

  if (!allowed)
    return <p className="text-sm text-muted-foreground">Recruitment reporting requires an approved recruiter, operations or administrator role.</p>;
  if (isError)
    return <p className="text-sm text-destructive">Unable to load authorized reports. Please retry.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Date-ranged recruitment pipeline reports. Financial and billing reporting remains paused.
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
        headers={["Recruiter (ID)", "Candidates Added", "Submissions", "Interviews", "Offers", "Joined"]}
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

    </div>
  );
}