// Public, unauthenticated job board index — no login, same trust model as
// /schedule/$token. Lists every currently-open job_openings row through
// careers.functions.ts's listOpenJobs (which runs as supabaseAdmin server-
// side; nothing here talks to Supabase directly from the browser). This is
// the page a recruiter links from a real job board, an email, or social —
// step 6's answer to "job board distribution" without needing a paid
// Indeed/Naukri/LinkedIn partner account this prototype doesn't have.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listOpenJobs } from "@/lib/careers.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/BrandMark";
import { useColorTheme } from "@/hooks/use-color-theme";
import { hexToRgba } from "@/lib/color-themes";
import { Briefcase, Inbox, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/careers")({ component: CareersPage });

const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

function CareersPage() {
  const { theme } = useColorTheme();
  const glow = hexToRgba(theme.mandala[0], 0.6);

  const runList = useServerFn(listOpenJobs);
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["careers-open-jobs"],
    queryFn: () => runList(),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center">
            <BrandLogo className="h-8 w-8" style={{ filter: `drop-shadow(0 0 5px ${glow})` }} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">AMF Synergy Vision</div>
            <div className="text-xs text-muted-foreground">Open Positions</div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold">Careers</h1>
          <p className="text-sm text-muted-foreground mt-1">Current openings we're actively hiring for — apply directly, no account needed.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 flex flex-col items-center justify-center gap-2 text-muted-foreground py-10">
              <Inbox className="h-6 w-6 opacity-50" />
              <div className="text-sm">No open positions right now — check back soon.</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} to="/careers/$jobId" params={{ jobId: job.id }} className="block">
                <Card className="card-hover transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{job.jobTitle}</CardTitle>
                        <CardDescription className="flex items-center gap-3 mt-1 flex-wrap">
                          {job.companyName && <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{job.companyName}</span>}
                          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                          {job.openPositions ? <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.openPositions} opening{job.openPositions > 1 ? "s" : ""}</span> : null}
                        </CardDescription>
                      </div>
                      {job.priority && <Badge variant="secondary">{PRIORITY_LABEL[job.priority] ?? job.priority}</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}