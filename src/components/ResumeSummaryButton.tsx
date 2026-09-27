// Standalone component, deliberately not built into CrudModule.tsx — that
// component is shared by 7 other modules (Clients, Jobs, Submissions, etc.)
// and this button's async Gemini call + loading/error states are specific
// to candidates, so it's rendered via the "render" prop on the Resume URL
// field instead, the same safe extension point already used for status
// pills elsewhere in the app.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { generateCandidateResumeSummary } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, TriangleAlert, ExternalLink } from "lucide-react";

interface Props {
  candidateId: string;
  fullName: string;
  resumeUrl: string | null;
  resumeSummary: string | null;
}

export function ResumeSummaryButton({ candidateId, fullName, resumeUrl, resumeSummary }: Props) {
  const [open, setOpen] = useState(false);
  const [showResumeText, setShowResumeText] = useState(false);
  const [savedSummary, setSavedSummary] = useState(resumeSummary);

  const runGenerate = useServerFn(generateCandidateResumeSummary);
  const genMut = useMutation({
    mutationFn: () => runGenerate({ data: { candidateId } }),
    onSuccess: (data) => setSavedSummary(data.summary),
  });

  if (!resumeUrl) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const resumeTextPreview = (genMut.data as { resumeText: string } | undefined)?.resumeText;

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOpen(true)}>
        <FileText className="h-3.5 w-3.5 mr-1.5" />
        {savedSummary ? "Summary" : "Generate summary"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resume summary — {fullName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
            >
              Open resume in Drive <ExternalLink className="h-3 w-3" />
            </a>

            {genMut.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            )}

            {genMut.isError && !genMut.isPending && (
              <div className="flex items-start gap-2 text-destructive">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{(genMut.error as any)?.message ?? "Couldn't generate a summary for this resume."}</span>
              </div>
            )}

            {savedSummary && !genMut.isPending ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{savedSummary}</p>
            ) : (
              !genMut.isPending && !genMut.isError && (
                <p className="text-muted-foreground">No summary generated yet.</p>
              )
            )}

            {resumeTextPreview && (
              <div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline underline-offset-2"
                  onClick={() => setShowResumeText((v) => !v)}
                >
                  {showResumeText ? "Hide" : "View"} extracted resume text
                </button>
                {showResumeText && (
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
                    {resumeTextPreview}
                  </pre>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button disabled={genMut.isPending} onClick={() => genMut.mutate()}>
              {genMut.isPending ? "Generating…" : savedSummary ? "Regenerate summary" : "Generate summary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}