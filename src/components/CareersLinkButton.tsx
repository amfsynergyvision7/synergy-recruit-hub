// Row-level widget for the Job Openings module (wired in via CrudModule's
// `render` field extension point, the same one ScheduleLinkButton uses on
// Interviews) — copies the public /careers/$jobId link for that job so a
// recruiter can paste it onto an actual job board, into an email, or a
// WhatsApp message. Unlike ScheduleLinkButton there's nothing to create
// server-side first: every open job_openings row is already reachable at
// this URL via careers.functions.ts, so this is just a clipboard copy.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

interface Props {
  job: any;
}

function buildLink(jobId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/careers/${jobId}`;
}

export function CareersLinkButton({ job }: Props) {
  const [copied, setCopied] = useState(false);

  if (job.status !== "open") {
    return <span className="text-xs text-muted-foreground">Not published</span>;
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildLink(job.id));
      setCopied(true);
      toast.success("Careers link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — the link is /careers/" + job.id);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyLink}>
      {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
      {copied ? "Copied" : "Copy Link"}
    </Button>
  );
}