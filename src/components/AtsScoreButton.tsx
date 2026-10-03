// ATS compatibility checker — same extension pattern as ResumeSummaryButton
// (rendered via the "render" prop on a field, not built into CrudModule.tsx,
// since the async Gemini call + loading/error states are specific to this
// one feature). Shows the persisted score (candidates.ats_score/ats_issues/
// ats_checked_at) as a pill the recruiter can click to see the full
// issue/strength breakdown, with a button to (re-)run the check.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { generateCandidateAtsScoreFn } from "@/lib/ai.functions";
import type { AtsIssue } from "@/lib/ai.server";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { ScanSearch, TriangleAlert, CheckCircle2 } from "lucide-react";

interface AtsIssuesPayload {
  issues: AtsIssue[];
  strengths: string[];
}

interface Props {
  candidateId: string;
  fullName: string;
  resumeUrl: string | null;
  atsScore: number | null;
  atsIssues: AtsIssuesPayload | null;
}

// Same 75/50 thresholds already used for match scores on the AI Match page
// (ai-match.tsx's local scoreTone) — kept consistent so a score reads the
// same way anywhere it appears in the CRM.
function scoreTone(score: number): PillTone {
  if (score >= 75) return "ok";
  if (score >= 50) return "warn";
  return "bad";
}

export function AtsScoreButton({ candidateId, fullName, resumeUrl, atsScore, atsIssues }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ score: number; issues: AtsIssue[]; strengths: string[] } | null>(
    atsScore != null ? { score: atsScore, issues: atsIssues?.issues ?? [], strengths: atsIssues?.strengths ?? [] } : null,
  );

  const runCheck = useServerFn(generateCandidateAtsScoreFn);
  const checkMut = useMutation({
    mutationFn: () => runCheck({ data: { candidateId } }),
    onSuccess: (data) => setSaved({ score: data.result.score, issues: data.result.issues, strengths: data.result.strengths }),
  });

  if (!resumeUrl) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOpen(true)}>
        <ScanSearch className="h-3.5 w-3.5 mr-1.5" />
        {saved ? <StatusPill label={`ATS ${saved.score}`} tone={scoreTone(saved.score)} /> : "Check ATS score"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ATS compatibility — {fullName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
            {checkMut.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            )}

            {checkMut.isError && !checkMut.isPending && (
              <div className="flex items-start gap-2 text-destructive">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{(checkMut.error as any)?.message ?? "Couldn't check this resume's ATS compatibility."}</span>
              </div>
            )}

            {saved && !checkMut.isPending ? (
              <>
                <div className="flex items-center gap-2">
                  <StatusPill label={`Score: ${saved.score} / 100`} tone={scoreTone(saved.score)} />
                </div>

                {saved.issues.length > 0 && (
                  <div>
                    <div className="font-medium mb-1.5">Issues to fix</div>
                    <ul className="space-y-1.5">
                      {saved.issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                          <span><span className="font-medium">{issue.label}:</span> <span className="text-muted-foreground">{issue.detail}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {saved.strengths.length > 0 && (
                  <div>
                    <div className="font-medium mb-1.5">Strengths</div>
                    <ul className="space-y-1.5">
                      {saved.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
                          <span className="text-muted-foreground">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              !checkMut.isPending && !checkMut.isError && (
                <p className="text-muted-foreground">No ATS check run yet.</p>
              )
            )}
          </div>

          <DialogFooter>
            <Button disabled={checkMut.isPending} onClick={() => checkMut.mutate()}>
              {checkMut.isPending ? "Checking…" : saved ? "Re-check" : "Check ATS score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}