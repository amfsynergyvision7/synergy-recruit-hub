import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchCandidates, matchCandidateWithResume } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Users, FileSearch, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import type { CandidateMatch, DeepCandidateMatch } from "@/lib/ai.server";

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

function MatchRow({ jobId, match }: { jobId: string; match: CandidateMatch }) {
  const [open, setOpen] = useState(false);
  const [showResumeText, setShowResumeText] = useState(false);
  const runDeepMatch = useServerFn(matchCandidateWithResume);
  const deepMut = useMutation({
    mutationFn: () => runDeepMatch({ data: { jobId, candidateId: match.candidateId } }),
  });

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !deepMut.data && !deepMut.isPending) deepMut.mutate();
  };

  const deep = deepMut.data as { match: DeepCandidateMatch; resumeText: string } | undefined;

  return (
    <div className="rounded-md border border-border">
      <div className="p-3">
        {/* Name/code/reason get the full-width row to themselves — wrapping,
            not shrink-0 — so they never have to fight the action buttons for
            space on a narrow phone (that's what let "CAND-1081" render on top
            of the score pill before). The score pill sits alone at top-right,
            small and shrink-0 with nothing else in its row to be squeezed by.
            The buttons move to their own flex-wrap row below a divider,
            mirroring the divider-plus-stacked-content pattern already used
            in CrudModule's mobile cards. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Deliberately NOT a flex row: a flex item's min-content width is
                computed from its longest unbreakable word regardless of
                break-words/overflow-wrap, so a name with no spaces (e.g. a
                long single-word surname) would still push past the
                container and back under the score pill. Plain block/inline
                flow has no such floor — it wraps to whatever width the
                min-w-0 parent above already resolved to. */}
            <div className="break-words font-medium">
              {match.fullName}
              {match.candidateCode && <span className="ml-2 text-xs font-normal text-muted-foreground">{match.candidateCode}</span>}
            </div>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{match.reason}</p>
          </div>
          <div className="shrink-0">
            <StatusPill label={`${match.score}/100`} tone={scoreTone(match.score)} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={handleToggle}>
            <FileSearch className="h-3.5 w-3.5 mr-1.5" />
            Deep match
            {open ? <ChevronUp className="h-3.5 w-3.5 ml-1.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/candidates">View</Link>
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/20 p-3">
          {deepMut.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          )}

          {deepMut.isError && !deepMut.isPending && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{(deepMut.error as any)?.message ?? "Couldn't score this candidate's resume."}</span>
            </div>
          )}

          {deep && !deepMut.isPending && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Resume-based score:</span>
                <StatusPill label={`${deep.match.score}/100`} tone={scoreTone(deep.match.score)} />
              </div>
              <p className="text-muted-foreground">{deep.match.summary}</p>
              {deep.match.strengths.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</span>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {deep.match.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {deep.match.gaps.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gaps</span>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {deep.match.gaps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline underline-offset-2"
                  onClick={() => setShowResumeText((v) => !v)}
                >
                  {showResumeText ? "Hide" : "View"} extracted resume text (proof this read the actual file)
                </button>
                {showResumeText && (
                  <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-background p-2 text-xs text-muted-foreground">
                    {deep.resumeText || "(no text extracted)"}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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

  const result = matchMut.data as { job: JobOption & { description: string | null; requirements: string | null }; matches: CandidateMatch[]; consideredCount: number } | undefined;

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
              {!result.job.description && !result.job.requirements && " This job has no Job Description or Requirements text yet — add some on the Job Openings page for sharper scoring."}
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
                <MatchRow key={m.candidateId} jobId={result.job.id} match={m} />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}