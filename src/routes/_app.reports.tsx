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
import { ALLOWED_REPORT_STAGES, UNASSIGNED_REPORT_KEY, assertRecruiterReportSourceIntegrity, assertReportSourceIntegrity, assertReportEventDates, linkedId, validReportWindow } from "@/lib/report-source-integrity";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

const STAGE_ORDER = ALLOWED_REPORT_STAGES;

const reportingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function reportingDateIso(date: Date): string {
  const parts = reportingDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function isoDateNDaysAgo(n: number): string {
  const date = new Date(`${reportingDateIso(new Date())}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

function inRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return false;
  const reportingDay = reportingDateIso(date);
  return reportingDay >= from && reportingDay <= to;
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
  const canReadOutcomes = role !== "recruiter";
  const [from, setFrom] = useState(() => isoDateNDaysAgo(30));
  const [to, setTo] = useState(() => reportingDateIso(new Date()));
  const validWindow = validReportWindow(from, to);

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
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, submission_date, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          readBoundedReportRows((from, to, abort) =>
            supabase.from("interviews")
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, status, interview_date, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal),
          canReadOutcomes ? readBoundedReportRows((from, to, abort) =>
            supabase.from("offers")
              .select("id, candidate_uuid, candidate_id, client_uuid, client_id, offer_status, joining_status, offer_date, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal) : Promise.resolve([]),
          canReadOutcomes ? readBoundedReportRows((from, to, abort) =>
            supabase.from("clients")
              .select("id, company_name", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(abort), signal) : Promise.resolve([]),
        ]);
        if (canReadOutcomes)
          assertReportSourceIntegrity({ candidates, submissions, interviews, offers, clients });
        else
          assertRecruiterReportSourceIntegrity({ candidates, submissions, interviews });
        // A partial date cohort is not a valid KPI, even when row counts match.
        assertReportEventDates({ candidates, submissions, interviews, offers });
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
    const m: Record<string, string | null> = Object.create(null);
    candidates.forEach((c: any) => { m[c.id] = c.assigned_recruiter; });
    return m;
  }, [candidates]);

  const clientNames = useMemo(() => {
    const m: Record<string, string> = Object.create(null);
    clients.forEach((c: any) => { m[c.id] = c.company_name; });
    return m;
  }, [clients]);

  const candidatesInRange = useMemo(() => validWindow ? candidates.filter((c: any) => inRange(c.created_at, from, to)) : [], [candidates, from, to, validWindow]);
  const submissionsInRange = useMemo(() => validWindow ? submissions.filter((s: any) => inRange(s.submission_date ?? s.created_at, from, to)) : [], [submissions, from, to, validWindow]);
  const interviewsInRange = useMemo(() => validWindow ? interviews.filter((i: any) => inRange(i.interview_date ?? i.created_at, from, to)) : [], [interviews, from, to, validWindow]);
  const offersInRange = useMemo(() => validWindow ? offers.filter((o: any) => inRange(o.offer_date ?? o.created_at, from, to)) : [], [offers, from, to, validWindow]);

  // --- Report 1: Candidate pipeline by stage ---
  const pipelineRows = useMemo(() => {
    const counts: Record<string, number> = Object.create(null);
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
    const rec: Record<string, { added: number; submissions: number; interviews: number; offers: number; joined: number }> = Object.create(null);
    const ensure = (id: string) => (rec[id] ??= { added: 0, submissions: 0, interviews: 0, offers: 0, joined: 0 });

    candidatesInRange.forEach((c: any) => { ensure(c.assigned_recruiter || UNASSIGNED_REPORT_KEY).added++; });
    submissionsInRange.forEach((s: any) => {
      const rid = recruiterOfCandidate[linkedId(s.candidate_uuid, s.candidate_id) || ""] || UNASSIGNED_REPORT_KEY;
      ensure(rid).submissions++;
    });
    interviewsInRange.forEach((i: any) => {
      const rid = recruiterOfCandidate[linkedId(i.candidate_uuid, i.candidate_id) || ""] || UNASSIGNED_REPORT_KEY;
      ensure(rid).interviews++;
    });
    offersInRange.forEach((o: any) => {
      const rid = recruiterOfCandidate[linkedId(o.candidate_uuid, o.candidate_id) || ""] || UNASSIGNED_REPORT_KEY;
      ensure(rid).offers++;
      if (o.joining_status === "joined") ensure(rid).joined++;
    });

    return Object.entries(rec)
      .sort((a, b) => b[1].added - a[1].added)
      .map(([id, v]) => canReadOutcomes
        ? [id === UNASSIGNED_REPORT_KEY ? "Unassigned" : recruiterLabel(id), v.added, v.submissions, v.interviews, v.offers, v.joined]
        : [id === UNASSIGNED_REPORT_KEY ? "Unassigned" : recruiterLabel(id), v.added, v.submissions, v.interviews]
      );
  }, [candidatesInRange, submissionsInRange, interviewsInRange, offersInRange, recruiterOfCandidate, canReadOutcomes]);

  // --- Report 3: Client-wise pipeline summary ---
  const clientRows = useMemo(() => {
    const byClient: Record<string, { submissions: number; interviews: number; offers: number; joined: number }> = Object.create(null);
    const ensure = (id: string) => (byClient[id] ??= { submissions: 0, interviews: 0, offers: 0, joined: 0 });

    submissionsInRange.forEach((s: any) => { const cid = linkedId(s.client_uuid, s.client_id); if (cid) ensure(cid).submissions++; });
    interviewsInRange.forEach((i: any) => { const cid = linkedId(i.client_uuid, i.client_id); if (cid) ensure(cid).interviews++; });
    offersInRange.forEach((o: any) => {
      const cid = linkedId(o.client_uuid, o.client_id);
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

  const applyPreset = (days: number) => { setFrom(isoDateNDaysAgo(days - 1)); setTo(reportingDateIso(new Date())); };
  const applyAllTime = () => { setFrom("2000-01-01"); setTo(reportingDateIso(new Date())); };

  if (!allowed)
    return <p className="text-sm text-muted-foreground">Recruitment reporting requires an approved recruiter, operations or administrator role.</p>;
  if (isError)
    return <p className="text-sm text-destructive">Unable to load authorized reports. Please retry.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Recruitment pipeline reports use Asia/Kolkata dates. Financial and billing reporting remains paused.
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

      {!validWindow ? (
        <p className="text-sm text-destructive">Choose a valid date range in YYYY-MM-DD format, with From on or before To. No metrics or exports are shown.</p>
      ) : (
        <>
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
        headers={canReadOutcomes
          ? ["Recruiter (ID)", "Candidates Added", "Submissions", "Interviews", "Offers", "Joined"]
          : ["Recruiter (ID)", "Candidates Added", "Submissions", "Interviews"]}
        rows={recruiterRows}
        filenamePrefix="recruiter-performance"
        loading={isLoading}
        emptyLabel="No recruiter activity in this window."
      />

      {canReadOutcomes && <ReportTable
        title="Client-wise Pipeline Summary"
        description="Submissions, interviews, and outcomes per client within the window."
        headers={["Client", "Submissions", "Interviews", "Offers", "Joined"]}
        rows={clientRows}
        filenamePrefix="client-pipeline-summary"
        loading={isLoading}
        emptyLabel="No client activity in this window."
      />}
        </>
      )}

    </div>
  );
}
