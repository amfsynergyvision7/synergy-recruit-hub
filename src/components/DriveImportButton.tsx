// "Check Google Drive for new resumes" — triggers the bulk-import server
// function and shows a results summary. The folder itself is configured
// once under Settings → Resume Import Folder; this button just runs the
// scan against whatever folder is saved there.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { checkDriveForNewResumes } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, TriangleAlert, UserPlus, UserCheck, FileWarning, FileX } from "lucide-react";

export function DriveImportButton() {
  const [open, setOpen] = useState(false);

  const runCheck = useServerFn(checkDriveForNewResumes);
  const mut = useMutation({
    mutationFn: () => runCheck(),
    onSuccess: () => setOpen(true),
  });

  const summary = mut.data;
  const failedOutcomes = summary?.outcomes.filter((o) => o.status === "failed") ?? [];
  const unsupportedOutcomes = summary?.outcomes.filter((o) => o.status === "skipped_unsupported_format") ?? [];

  // A bare "Failed to fetch" (or "NetworkError…" in Firefox) is the browser's
  // own message for a request that never got a response at all — different
  // from every other error this feature throws, which are all descriptive
  // sentences written by our own code. In practice this has meant the
  // server function got killed mid-run by Vercel's function-duration limit
  // before it could reply, so the guidance here is specific to that, rather
  // than the generic fallback message below.
  const rawErrorMessage = (mut.error as any)?.message as string | undefined;
  const looksLikeDroppedConnection = !!rawErrorMessage && /failed to fetch|networkerror|load failed/i.test(rawErrorMessage);
  const errorMessage = looksLikeDroppedConnection
    ? "The connection was lost before this finished — most likely the run took longer than the server allows in one go. Any files it got through before that are already saved (they won't be reprocessed). Try \"Run again\"; if it keeps happening, the folder may need to be scanned in smaller batches, or the account's Function Max Duration setting may need raising in Vercel."
    : rawErrorMessage ?? "Couldn't check Drive for new resumes.";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={mut.isPending}
        onClick={() => { setOpen(true); mut.mutate(); }}
      >
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${mut.isPending ? "animate-spin" : ""}`} />
        {mut.isPending ? "Checking Drive…" : "Check Google Drive for new resumes"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Drive resume import</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {mut.isPending && (
              <p className="text-muted-foreground">Scanning your configured Drive folder — this can take a minute for a large batch…</p>
            )}

            {mut.isError && !mut.isPending && (
              <div className="flex items-start gap-2 text-destructive">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {summary && !mut.isPending && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border p-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><UserPlus className="h-3.5 w-3.5" />New candidates</div>
                    <div className="text-lg font-semibold">{summary.created}</div>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><UserCheck className="h-3.5 w-3.5" />Existing updated</div>
                    <div className="text-lg font-semibold">{summary.updated}</div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {summary.totalInFolder} file{summary.totalInFolder === 1 ? "" : "s"} in the folder · {summary.alreadyImported} already imported (skipped) · {summary.processed} processed this run
                  {summary.remaining > 0 && ` · ${summary.remaining} more new file(s) found — run this again to continue`}
                </p>

                {unsupportedOutcomes.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FileWarning className="h-3.5 w-3.5" />Skipped — not PDF or Word ({unsupportedOutcomes.length})</div>
                    <ul className="text-xs text-muted-foreground max-h-20 overflow-y-auto space-y-0.5">
                      {unsupportedOutcomes.map((o, i) => <li key={i}>{o.fileName}</li>)}
                    </ul>
                  </div>
                )}

                {failedOutcomes.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-destructive"><FileX className="h-3.5 w-3.5" />Failed ({failedOutcomes.length})</div>
                    <ul className="text-xs text-muted-foreground max-h-24 overflow-y-auto space-y-0.5">
                      {failedOutcomes.map((o, i) => (
                        <li key={i}>{o.fileName}: {o.status === "failed" ? o.reason : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Checking…" : "Run again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}