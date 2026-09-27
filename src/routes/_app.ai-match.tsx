import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchCandidates } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Users } from "lucide-react";
import type { CandidateMatch } from "@/lib/ai.server";

export const Route = createFileRoute("/_app/ai-match")({ component: Page });

interface JobOption {
  id: string;
  job_title: string;
  status: string | null;
}

function scoreTone(score: number): PillTone {
  if (score >= 75) return "ok";
  if (score >= 50) return "warn";
  return "bad";
}

function Page() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setJobsLoading(true);
      const { data, error } = await supabase
        .from("job_openings")
        .select("id, job_title, status")
        .in("status", ["open", "on_hold"])
        .order("created_at", { ascending: false });
      setJobsLoading(false);
      if (error) return toast.error(error.message);
      setJobs((data as JobOption[]) ?? []);
    };
    load();
  }, []);

  const runMatch = useServerFn(matchCandidates);
  const matchMut = useMutation({
    mutationFn: (jobId: string) => runMatch({ data: { jobId } }),
    onError: (err: any) => toast.error(err?.message ?? "Matching failed"),
  });

  const result = matchMut.data as { job: JobOption & { requirements: string | null }; matches: CandidateMatch[]; consideredCount: number } | undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />AI Candidate Match
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a job opening and Gemini scores your active candidate pool against it. Rejected and dropped candidates are excluded automatically.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder={jobsLoading ? "Loading jobs…" : "Select a job opening…"} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.job_title}</SelectItem>
              ))}
              {!jobsLoading && jobs.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No open job openings</div>
              )}
            </SelectContent>
          </Select>
          <Button disabled={!selectedJobId || matchMut.isPending} onClick={() => matchMut.mutate(selectedJobId)}>
            <Sparkles className="h-4 w-4 mr-2" />
            {matchMut.isPending ? "Matching…" : "Find matches"}
          </Button>
        </CardContent>
      </Card>

      {matchMut.isPending && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {[100, 92, 85, 78].map((w, i) => <Skeleton key={i} className="h-14" style={{ width: `${w}%` }} />)}
          </CardContent>
        </Card>
      )}

      {result && !matchMut.isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Matches for "{result.job.job_title}"</CardTitle>
            <CardDescription>
              Scored against your {result.consideredCount} most recently updated active candidate{result.consideredCount === 1 ? "" : "s"}.
              {!result.job.requirements && " This job has no Requirements text yet — add some on the Job Openings page for sharper scoring."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.matches.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <Users className="h-8 w-8 opacity-40" />
                No active candidates to match against yet.
              </div>
            ) : (
              result.matches.map((m) => (
                <div key={m.candidateId} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.fullName}</span>
                      {m.candidateCode && <span className="shrink-0 text-xs text-muted-foreground">{m.candidateCode}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill label={`${m.score}/100`} tone={scoreTone(m.score)} />
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/candidates">View</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}