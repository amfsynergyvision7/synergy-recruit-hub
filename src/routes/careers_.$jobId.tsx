// Public, unauthenticated job detail + apply page — the page a "View &
// Apply" link from /careers (or a link shared directly, e.g. on an actual
// job board) lands on. Submitting calls submitJobApplication, which creates
// (or reuses, via the same dedupe.ts normalization the Duplicate Candidates
// tool uses) a candidate record and a submissions row tied to this job —
// landing the applicant straight in the normal pipeline, same as if a
// recruiter had entered them by hand.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getJobDetail, submitJobApplication } from "@/lib/careers.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo, BrandCircuit } from "@/components/BrandMark";
import { useColorTheme } from "@/hooks/use-color-theme";
import { useForceDarkTheme } from "@/hooks/use-theme";
import { hexToRgba } from "@/lib/color-themes";
import { Briefcase, CheckCircle2, MapPin, TriangleAlert, Users } from "lucide-react";

export const Route = createFileRoute("/careers_/$jobId")({ component: JobApplyPage });

interface FormState {
  fullName: string; email: string; mobile: string; currentCompany: string;
  experienceYears: string; expectedSalary: string; noticePeriod: string;
  resumeUrl: string; coverNote: string;
}

const EMPTY_FORM: FormState = {
  fullName: "", email: "", mobile: "", currentCompany: "",
  experienceYears: "", expectedSalary: "", noticePeriod: "", resumeUrl: "", coverNote: "",
};

function fmtSalary(n: number | null): string {
  return n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "";
}

function JobApplyPage() {
  // See careers.tsx's identical call for why this is needed: this page also
  // sits outside the _app layout that's the only place dark mode normally
  // gets applied, so without this it renders the org's theme in its light
  // variant instead of the dark one the rest of the CRM uses.
  useForceDarkTheme();
  const { jobId } = Route.useParams();
  const { theme } = useColorTheme();
  const glow = hexToRgba(theme.mandala[0], 0.6);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const runDetail = useServerFn(getJobDetail);
  const detailQuery = useQuery({
    queryKey: ["careers-job-detail", jobId],
    queryFn: () => runDetail({ data: { jobId } }),
    retry: false,
  });
  const detailErrorMessage = (detailQuery.error as any)?.message as string | undefined;

  const runApply = useServerFn(submitJobApplication);
  const applyMut = useMutation({
    mutationFn: () => runApply({
      data: {
        jobId,
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile,
        currentCompany: form.currentCompany || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : undefined,
        noticePeriod: form.noticePeriod || undefined,
        resumeUrl: form.resumeUrl || undefined,
        coverNote: form.coverNote || undefined,
      },
    }),
  });

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const job = detailQuery.data;
  const salaryRange = job && (job.salaryMin || job.salaryMax)
    ? [fmtSalary(job.salaryMin), fmtSalary(job.salaryMax)].filter(Boolean).join(" – ")
    : null;

  return (
    <div className="relative isolate overflow-hidden min-h-screen bg-background">
      <BrandCircuit
        className="absolute -top-24 -right-24 h-[75vh] w-[75vh] -z-10 pointer-events-none"
        style={{ opacity: 0.3 }}
      />
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center">
            <BrandLogo className="h-8 w-8" style={{ filter: `drop-shadow(0 0 5px ${glow})` }} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">AMF Synergy Vision</div>
            <div className="text-xs text-muted-foreground">Careers</div>
          </div>
        </div>

        {detailQuery.isLoading && (
          <Card><CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-32 w-full" />
          </CardContent></Card>
        )}

        {detailQuery.isError && !detailQuery.isLoading && (
          <Card><CardContent className="pt-6">
            <div className="flex items-start gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">This posting isn't available</div>
                <p className="text-sm text-muted-foreground mt-1">It may have closed or the link may be out of date.</p>
                {/* Same reasoning as careers.tsx's isError branch: surfaces
                    the real fetch error (env var, schema, RLS) instead of
                    only ever showing this generic "not found" copy, which
                    used to make a genuine outage indistinguishable from a
                    stale link. */}
                {detailErrorMessage && (
                  <p className="text-xs text-muted-foreground/70 mt-2">{detailErrorMessage}</p>
                )}
              </div>
            </div>
          </CardContent></Card>
        )}

        {job && !detailQuery.isLoading && !detailQuery.isError && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{job.jobTitle}</CardTitle>
                <CardDescription className="flex items-center gap-3 flex-wrap mt-1">
                  {job.companyName && <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{job.companyName}</span>}
                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                  {job.openPositions ? <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.openPositions} opening{job.openPositions > 1 ? "s" : ""}</span> : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {salaryRange && <div><span className="font-medium">Compensation: </span>{salaryRange}</div>}
                {job.description && <div className="whitespace-pre-wrap">{job.description}</div>}
                {job.requirements && (
                  <div>
                    <div className="font-medium mb-1">Requirements</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{job.requirements}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {!job.isOpen ? (
              <Card><CardContent className="pt-6 text-sm text-muted-foreground">This position is no longer accepting applications.</CardContent></Card>
            ) : applyMut.isSuccess ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <div className="font-medium">{applyMut.data?.alreadyApplied ? "You've already applied" : "Application received"}</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {applyMut.data?.alreadyApplied
                          ? "We already have your application for this role on file — no need to resubmit."
                          : "Thanks for applying — our team will review it and reach out if it's a fit."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Apply for this role</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Full Name *</Label>
                      <Input value={form.fullName} onChange={set("fullName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mobile *</Label>
                      <Input type="tel" value={form.mobile} onChange={set("mobile")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Email *</Label>
                      <Input type="email" value={form.email} onChange={set("email")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Current Company</Label>
                      <Input value={form.currentCompany} onChange={set("currentCompany")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Experience (yrs)</Label>
                      <Input type="number" value={form.experienceYears} onChange={set("experienceYears")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expected Salary</Label>
                      <Input type="number" value={form.expectedSalary} onChange={set("expectedSalary")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Notice Period</Label>
                      <Input value={form.noticePeriod} onChange={set("noticePeriod")} placeholder="e.g. 30 days" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Resume Link <span className="text-xs text-muted-foreground font-normal">(Google Drive / Dropbox share link)</span></Label>
                      <Input type="url" value={form.resumeUrl} onChange={set("resumeUrl")} placeholder="https://drive.google.com/…" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Cover Note <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                      <Textarea value={form.coverNote} onChange={set("coverNote")} rows={3} />
                    </div>
                  </div>
                  {applyMut.isError && (
                    <p className="text-sm text-destructive">{(applyMut.error as any)?.message ?? "Couldn't submit your application — please try again."}</p>
                  )}
                  <Button
                    className="w-full"
                    disabled={applyMut.isPending || !form.fullName || !form.email || !form.mobile}
                    onClick={() => applyMut.mutate()}
                  >
                    {applyMut.isPending ? "Submitting…" : "Submit Application"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}