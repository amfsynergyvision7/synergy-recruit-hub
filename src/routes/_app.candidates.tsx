import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { CandidateBoard } from "@/components/CandidateBoard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { ResumeSummaryButton } from "@/components/ResumeSummaryButton";
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
  const [recruiters, setRecruiters] = useState<{ value: string; label: string }[]>([]);
  const [view, setView] = useState<"table" | "board">("table");

  useEffect(() => {
    const fetchRecruiters = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('status', 'approved')
        .order('full_name');
      
      if (!error && data) {
        setRecruiters(data.map((recruiter: { id: string; full_name: string; email: string }) => ({
          value: recruiter.id,
          label: recruiter.full_name || recruiter.email
        })));
      }
    };
    
    fetchRecruiters();
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
      detailView
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