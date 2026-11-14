// Reusable "send an email" dialog, opened from a Mail icon on any CrudModule
// row that has `emailField` configured (currently Candidates and Clients —
// see the emailField prop on those two route configs). Kept as its own
// component rather than inlined in CrudModule.tsx for the same reason
// ResumeSummaryButton is separate: CrudModule is shared by 8 modules, and
// this dialog's async send/template state is specific to the one feature.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sendCrmEmail, listEmailHistory, getEmailMergeContext, type EmailMergeContext } from "@/lib/email.functions";
import { useAuth } from "@/hooks/use-auth";
import { CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED, CRM_EMAIL_COMPOSER_HOLD_REASON, assertCrmEmailSendAllowed } from "@/lib/release-safety";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, TriangleAlert } from "lucide-react";

type RelatedTable = "candidates" | "clients";

interface Template {
  key: string;
  label: string;
  subject: string;
  body: string;
}

// Templates are draft-only. Never imply terms, fees, selection or other
// commitments that are not separately approved. D-003 remains inactive.
const TEMPLATES: Template[] = [
  { key: "custom", label: "Custom draft (blank)", subject: "", body: "" },
  {
    key: "neutral_follow_up",
    label: "Neutral follow-up (draft only)",
    subject: "Follow-up",
    body: "Hello {{name}},\n\nPlease let us know if you would like to discuss next steps.\n\n{{signature}}",
  },
];

function buildSignature(ownerName: string | null | undefined): string {
  return `Best regards,\n${ownerName ? ownerName + "\n" : ""}AMF Synergy Vision`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedTable: RelatedTable;
  relatedId: string;
  toEmail: string;
  toName: string;
}

export function EmailComposeDialog({ open, onOpenChange, relatedTable, relatedId, toEmail, toName }: Props) {
  const { user } = useAuth();
  const [templateKey, setTemplateKey] = useState("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      setTemplateKey("custom");
      setSubject("");
      setBody("");
    }
  }, [open, relatedTable, relatedId, toEmail]);

  const runMergeContext = useServerFn(getEmailMergeContext);
  const mergeQuery = useQuery({
    queryKey: ["email-merge-context", user?.id ?? "signed-out", relatedTable, relatedId],
    queryFn: () => runMergeContext({ data: { relatedTable, relatedId } }),
    enabled: open && !!user?.id && !CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED,
  });

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const t = TEMPLATES.find((t) => t.key === key);
    if (!t) return;
    const name = toName || "there";
    // Falls back to the bracketed placeholder form on company/position if
    // the lookup genuinely found nothing (e.g. a candidate with no
    // submission yet) — the Select is disabled while this is still
    // loading (below), so in the normal case this data is already here by
    // the time a template gets picked.
    const ctx: Partial<EmailMergeContext> = mergeQuery.data ?? {};
    setSubject(t.subject);
    setBody(
      t.body
        .replace(/\{\{name\}\}/g, name)
        .replace(/\{\{company\}\}/g, ctx.company || "[Client Company]")
        .replace(/\{\{position\}\}/g, ctx.position || "[Position]")
        .replace(/\{\{signature\}\}/g, buildSignature(ctx.ownerName)),
    );
  };

  const runSend = useServerFn(sendCrmEmail);
  const sendMut = useMutation({
    mutationFn: () => {
      // Server-side crm_email release hold separately rejects direct RPCs.
      assertCrmEmailSendAllowed();
      return runSend({ data: { relatedTable, relatedId, toEmail, subject, body } });
    },
    onSuccess: () => {
      toast.success(`Email sent to ${toEmail}`);
      onOpenChange(false);
      historyQuery.refetch();
    },
    onError: () => toast.error(CRM_EMAIL_COMPOSER_HOLD_REASON),
  });

  const runHistory = useServerFn(listEmailHistory);
  const historyQuery = useQuery({
    queryKey: ["email-history", user?.id ?? "signed-out", relatedTable, relatedId],
    queryFn: () => runHistory({ data: { relatedTable, relatedId } }),
    enabled: open && !!user?.id && !CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email {toName || toEmail}</DialogTitle>
          <DialogDescription>
            Draft only. Outbound CRM email and correspondence retrieval are paused pending independent approval.
            No email is sent from this screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input value={toEmail} disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              Template
              {mergeQuery.isLoading && <span className="text-xs font-normal text-muted-foreground">Loading details…</span>}
            </Label>
            <Select value={templateKey} onValueChange={applyTemplate} disabled={mergeQuery.isLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
          </div>

          {!!historyQuery.data?.length && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <Label className="text-xs text-muted-foreground">Previously sent to this record</Label>
              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {historyQuery.data.map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    {h.status === "failed" && <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />}
                    <div className="min-w-0">
                      <span className="font-medium">{h.subject}</span>
                      <span className="text-muted-foreground"> — {new Date(h.created_at).toLocaleString()}{h.status === "failed" ? " (failed)" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED || sendMut.isPending || !subject.trim() || !body.trim()}
            onClick={() => {
              if (CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED) return;
              sendMut.mutate();
            }}>
            {CRM_EMAIL_COMPOSER_MUTATIONS_PAUSED ? "Sending paused" : sendMut.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}