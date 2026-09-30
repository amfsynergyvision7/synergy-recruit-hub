// Reusable "send an email" dialog, opened from a Mail icon on any CrudModule
// row that has `emailField` configured (currently Candidates and Clients —
// see the emailField prop on those two route configs). Kept as its own
// component rather than inlined in CrudModule.tsx for the same reason
// ResumeSummaryButton is separate: CrudModule is shared by 8 modules, and
// this dialog's async send/template state is specific to the one feature.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sendCrmEmail, listEmailHistory } from "@/lib/email.functions";
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

// {{name}} is replaced with the record's own display name below (candidate's
// full name, or the client's contact/company name) when a template is
// picked — kept intentionally generic so the same templates work for both
// candidates and client contacts rather than needing separate sets.
//
// Bracketed placeholders like [Client Company] and [Your Phone Number] are
// deliberately NOT auto-filled the way {{name}} is — they vary per send (a
// different client each time, a different recruiter's callback number), so
// they're left for whoever is sending to fill in by hand before hitting
// Send, same as they'd edit a subject line.
const TEMPLATES: Template[] = [
  { key: "custom", label: "Custom (blank)", subject: "", body: "" },
  {
    key: "selection_confirmation",
    label: "Selection confirmed — agreement acknowledgment",
    subject: "Congratulations! You've Been Selected — Next Steps & Agreement",
    body:
      "Hi {{name}},\n\n" +
      "Congratulations! We're delighted to let you know that you've been selected following your recent interview.\n\n" +
      "As discussed, this opportunity was shared directly through our network at [Client Company], with your profile personally routed through our reference on their senior leadership team — which is part of why it was given the priority and consideration it deserved.\n\n" +
      "To move forward, we're attaching our Candidate Placement & Recruitment Service Agreement. Please take a moment to review it — in summary, it covers:\n\n" +
      "- A Placement Service Fee of 25% of your first month's gross salary, payable to us within 7 days of receiving that salary\n" +
      "- A commitment to continue in the role for a minimum of 45 days from your date of joining\n" +
      "- Providing us at least 7 days' written notice if you need to resign before receiving your first salary\n" +
      "- Keeping us promptly informed if your joining or continued employment is affected in any way\n\n" +
      "Please sign the agreement (physically or digitally), and email the scanned copy back to info@amfsynergyvision.com within 24 hours of receiving this email. You can also simply reply \"I Agree\" to this email to confirm you've read and accepted the terms, alongside sending the signed copy.\n\n" +
      "Once again, congratulations — we're genuinely glad to have supported you through this process, and we look forward to seeing you succeed in this new role.\n\n" +
      "Best regards,",
  },
  {
    key: "missed_contact",
    label: "We've been trying to reach you",
    subject: "We've Been Trying to Reach You",
    body:
      "Hi {{name}},\n\n" +
      "We've been trying to reach you a few times regarding your application, but haven't been able to connect.\n\n" +
      "Could you give us a call back at [Your Phone Number] at your earliest convenience? There's an update on your application we'd like to share with you directly.\n\n" +
      "If it's easier, feel free to reply to this email with a good time to reach you instead.\n\n" +
      "Looking forward to connecting soon.\n\n" +
      "Best regards,",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedTable: RelatedTable;
  relatedId: string;
  toEmail: string;
  toName: string;
}

export function EmailComposeDialog({ open, onOpenChange, relatedTable, relatedId, toEmail, toName }: Props) {
  const [templateKey, setTemplateKey] = useState("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      setTemplateKey("custom");
      setSubject("");
      setBody("");
    }
  }, [open, relatedId]);

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const t = TEMPLATES.find((t) => t.key === key);
    if (!t) return;
    const name = toName || "there";
    setSubject(t.subject);
    setBody(t.body.replace(/\{\{name\}\}/g, name));
  };

  const runSend = useServerFn(sendCrmEmail);
  const sendMut = useMutation({
    mutationFn: () => runSend({ data: { relatedTable, relatedId, toEmail, subject, body } }),
    onSuccess: () => {
      toast.success(`Email sent to ${toEmail}`);
      onOpenChange(false);
      historyQuery.refetch();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to send email."),
  });

  const runHistory = useServerFn(listEmailHistory);
  const historyQuery = useQuery({
    queryKey: ["email-history", relatedTable, relatedId],
    queryFn: () => runHistory({ data: { relatedTable, relatedId } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email {toName || toEmail}</DialogTitle>
          <DialogDescription>Sends from your CRM's configured address and logs a copy below for the next person who opens this record.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input value={toEmail} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateKey} onValueChange={applyTemplate}>
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
          <Button disabled={sendMut.isPending || !subject.trim() || !body.trim()} onClick={() => sendMut.mutate()}>
            {sendMut.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}