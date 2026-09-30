// Standalone component wired into the Interviews module via a `render` field,
// the same extension point ResumeSummaryButton uses on Candidates — kept
// separate from CrudModule.tsx (shared by 8 modules) since this button's
// async create-link flow and two-stage dialog are specific to Interviews.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { createSchedulingLink } from "@/lib/scheduling.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarClock, Copy, Check } from "lucide-react";

interface Props {
  interview: any;
}

function buildLink(token: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/schedule/${token}`;
}

function slotsFromRow(interview: any): string[] {
  const existing: string[] = Array.isArray(interview?.proposed_slots) ? interview.proposed_slots : [];
  return [existing[0] ?? "", existing[1] ?? "", existing[2] ?? ""];
}

export function ScheduleLinkButton({ interview }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"edit" | "ready">("edit");
  const [slots, setSlots] = useState<string[]>(["", "", ""]);
  const [readyToken, setReadyToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openDialog = () => {
    setCopied(false);
    if (interview.status === "awaiting_candidate" && interview.scheduling_token) {
      setReadyToken(interview.scheduling_token);
      setStage("ready");
    } else {
      setSlots(slotsFromRow(interview));
      setStage("edit");
    }
    setOpen(true);
  };

  const runCreate = useServerFn(createSchedulingLink);
  const createMut = useMutation({
    mutationFn: () => runCreate({ data: { interviewId: interview.id, slots: slots.filter(Boolean) } }),
    onSuccess: (res) => {
      setReadyToken(res.token);
      setStage("ready");
    },
    onError: (err: any) => toast.error(err?.message ?? "Couldn't create the scheduling link."),
  });

  const link = readyToken ? buildLink(readyToken) : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy automatically — select and copy the link above manually.");
    }
  };

  const filledCount = slots.filter(Boolean).length;
  const buttonLabel = interview.status === "awaiting_candidate" ? "View link" : interview.interview_date ? "Reschedule" : "Get link";

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={openDialog}>
        <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {stage === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>Propose interview times</DialogTitle>
                <DialogDescription>
                  Offer up to 3 slots — the candidate picks one from a link you send them, no account needed on their end.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Label>Option {i + 1}{i === 0 ? "" : " (optional)"}</Label>
                    <Input
                      type="datetime-local"
                      value={slots[i]}
                      onChange={(e) => setSlots((s) => s.map((v, idx) => (idx === i ? e.target.value : v)))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={filledCount === 0 || createMut.isPending} onClick={() => createMut.mutate()}>
                  {createMut.isPending ? "Creating…" : "Create link"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Scheduling link ready</DialogTitle>
                <DialogDescription>
                  Share this with the candidate — status is now "Awaiting Candidate" until they pick a time.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
                <code className="flex-1 truncate text-xs">{link}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyLink}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setSlots(slotsFromRow(interview)); setStage("edit"); }}>
                  Change times
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}