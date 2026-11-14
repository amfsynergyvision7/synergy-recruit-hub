import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { CandidateBoard } from "@/components/CandidateBoard";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canMountApprovedCrm } from "@/lib/crm-shell-access";
import { supabase } from "@/integrations/supabase/client";
import { readVerifiedRecruiterChoices } from "@/lib/recruiter-selector-read";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { ResumeSummaryButton } from "@/components/ResumeSummaryButton";
import { AtsScoreButton } from "@/components/AtsScoreButton";
import { ClientResumePdfButton } from "@/components/ClientResumePdfButton";
import { DriveImportButton } from "@/components/DriveImportButton";
import { PhoneCell } from "@/components/PhoneCell";
import { Table2, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_app/candidates")({ component: Page });

const stages = [
  "lead_received","contacted","interested","resume_collected","submitted_to_client",
  "interview_scheduled","interview_completed","selected","offer_released","joined","rejected","dropped"
].map(v => ({ value: v, label: v.replace(/_/g," ") }));

const STAGE_TONE: Record<string, PillTone> = {
  lead_received: "ok",
  contacted: "warn",
  interested: "ok",
  resume_collected: "warn",
  submitted_to_client: "info",
  interview_scheduled: "warn",
  interview_completed: "info",
  selected: "ok",
  offer_released: "ok",
  joined: "ok",
  rejected: "bad",
  dropped: "info",
};

function Page() {
  const { user, profile, role, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Checking candidate access…</p>;
  if (!canMountApprovedCrm(user?.id, profile, role))
    return <p className="text-sm text-muted-foreground">Approved CRM access is required.</p>;
  return <CandidateWorkspace key={user!.id + ":" + role} />;
}

function CandidateWorkspace() {
  const [recruiters, setRecruiters] = useState<{ value: string; label: string }[]>([]);
  const [recruiterDirectoryReady, setRecruiterDirectoryReady] = useState(false);
  const [recruiterDirectoryFailed, setRecruiterDirectoryFailed] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");

  useEffect(() => {
    // Only active, approved recruiters may be offered as assignees.
    // The owner/role-keyed candidate workspace is not mounted before login.
    const controller = new AbortController();
    let current = true;
    setRecruiters([]);
    setRecruiterDirectoryReady(false);
    setRecruiterDirectoryFailed(false);
    const fetchRecruiters = async () => {
      try {
        const choices = await readVerifiedRecruiterChoices(
          async (from, to, signal) => {
            const result = await supabase.from("user_roles")
              .select("id, user_id, role", { count: "exact" })
              .eq("role", "recruiter")
              .order("id", { ascending: true }).range(from, to)
              .abortSignal(signal);
            return { data: result.data, count: result.count, error: result.error };
          },
          async (ids, signal) => {
            const result = await supabase.from("profiles")
              .select("id, full_name", { count: "exact" })
              .in("id", Array.from(ids)).eq("status", "approved")
              .eq("is_active", true)
              .order("id", { ascending: true })
              .range(0, ids.length - 1).abortSignal(signal);
            return { data: result.data, count: result.count, error: result.error };
          },
          controller.signal,
        );
        if (!current || controller.signal.aborted) return;
        setRecruiters(choices);
        setRecruiterDirectoryReady(true);
      } catch {
        if (current && !controller.signal.aborted) {
          setRecruiters([]);
          setRecruiterDirectoryReady(false);
          setRecruiterDirectoryFailed(true);
        }
      }
    };
    void fetchRecruiters();
    return () => { current = false; controller.abort(); };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <DriveImportButton />
        <div className="inline-flex rounded-md border border-border p-0.5">
          <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
            <Table2 className="h-3.5 w-3.5 mr-1.5" />Table
          </Button>
          <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setView("board")}>
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />Board
          </Button>
        </div>
      </div>
      {!recruiterDirectoryReady && (
        <p role="status" className="text-sm text-muted-foreground">
          {recruiterDirectoryFailed
            ? "Recruiter assignee choices could not be verified. Candidate editing and exports remain held."
            : "Verifying complete recruiter assignee choices; candidate editing and exports remain held."}
        </p>
      )}
      {view === "board" ? (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Candidates</h1>
            <p className="text-sm text-muted-foreground">Full candidate pipeline with automated stage tracking. Drag a card to move it to a new stage.</p>
          </div>
          <CandidateBoard stages={stages} stageTone={STAGE_TONE} recruiters={recruiters} />
        </div>
      ) : (
    <CrudModule
      title="Candidates"
      description="Full candidate pipeline with automated stage tracking."
      table="candidates"
      module="candidates"
      requiredReferenceReady={recruiterDirectoryReady}
      detailView
      emailField="email"
      searchFields={["full_name","email","mobile","candidate_code","position_applied"]}
      fields={[
        // Only Name, Phone, Email, the resume Summary button, and Stage show
        // in the table itself — everything else below is still fully
        // editable via Add/Edit and always visible in the "eye" detail panel,
        // it's just no longer cluttering the list view. Kept in this order
        // deliberately, since it's also the order fields appear in that panel.
        { name: "candidate_code", label: "Code", hideInForm: true, hideInTable: true },
        { name: "full_name", label: "Full Name", required: true, essential: true },
        {
          name: "mobile",
          label: "Mobile",
          type: "tel",
          essential: true,
          render: (row) => <PhoneCell value={row.mobile} />,
        },
        { name: "email", label: "Email", type: "email" },
        { name: "location", label: "Location", hideInTable: true },
        { name: "position_applied", label: "Position", hideInTable: true },
        { name: "current_company", label: "Current Company", hideInTable: true },
        { name: "experience_years", label: "Experience (yrs)", type: "number", hideInTable: true },
        { name: "current_salary", label: "Current Salary", type: "number", hideInTable: true },
        { name: "expected_salary", label: "Expected Salary", type: "number", hideInTable: true },
        { name: "notice_period", label: "Notice Period", hideInTable: true },
        {
          name: "resume_url",
          label: "Resume / Summary",
          render: (row) => (
            <ResumeSummaryButton
              candidateId={row.id}
              fullName={row.full_name}
              resumeUrl={row.resume_url}
              resumeSummary={row.resume_summary}
            />
          ),
        },
        {
          // Real column (candidates.ats_score/ats_issues/ats_checked_at —
          // see the ATS Resume Maker migration) — persisted per the user's
          // choice to save the check rather than regenerate it every time.
          // hideInTable: the table row was getting too cramped with every
          // action button inline — this (and client_resume below) now only
          // shows in the "eye" detail panel, same as every other
          // hideInTable field above. The detail view always renders the
          // full `fields` list regardless of hideInTable, so nothing is
          // actually lost — it's one click away instead of in the row.
          name: "ats_score",
          label: "ATS Score",
          hideInForm: true,
          hideInTable: true,
          render: (row) => (
            <AtsScoreButton
              candidateId={row.id}
              fullName={row.full_name}
              resumeUrl={row.resume_url}
              atsScore={row.ats_score}
              atsIssues={row.ats_issues}
            />
          ),
        },
        {
          // Pseudo-field: no backing column, purely an extension point for
          // the client-resume PDF download button (cellDisplayValue safely
          // renders an empty cell for it outside this render — e.g. in CSV
          // export — since row.client_resume is simply undefined).
          name: "client_resume",
          label: "Client Resume",
          hideInForm: true,
          hideInTable: true,
          render: (row) => <ClientResumePdfButton candidateId={row.id} resumeUrl={row.resume_url} />,
        },
        { name: "source", label: "Source", hideInTable: true },
        {
          name: "stage",
          label: "Stage",
          type: "select",
          options: stages,
          default: "lead_received",
          essential: true,
          render: (row) =>
            row.stage ? (
              <StatusPill label={String(row.stage).replace(/_/g, " ")} tone={STAGE_TONE[row.stage] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
        {
          name: "assigned_recruiter",
          label: "Assigned Recruiter",
          type: "select",
          options: recruiters,
          hideInTable: true,
        },
        { name: "notes", label: "Notes", type: "textarea", hideInTable: true },
      ]}
    />
      )}
    </div>
  );
}