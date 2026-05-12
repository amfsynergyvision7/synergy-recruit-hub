import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/candidates")({ component: Page });

const stages = [
  "lead_received","contacted","interested","resume_collected","submitted_to_client",
  "interview_scheduled","interview_completed","selected","offer_released","joined","rejected","dropped"
].map(v => ({ value: v, label: v.replace(/_/g," ") }));

function Page() {
  return (
    <CrudModule
      title="Candidates"
      description="Full candidate pipeline with automated stage tracking."
      table="candidates"
      module="candidates"
      searchFields={["full_name","email","mobile","candidate_code","position_applied"]}
      fields={[
        { name: "candidate_code", label: "Code", hideInForm: true },
        { name: "full_name", label: "Full Name", required: true },
        { name: "mobile", label: "Mobile", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "location", label: "Location" },
        { name: "position_applied", label: "Position" },
        { name: "current_company", label: "Current Company", hideInTable: true },
        { name: "experience_years", label: "Experience (yrs)", type: "number" },
        { name: "current_salary", label: "Current Salary", type: "number", hideInTable: true },
        { name: "expected_salary", label: "Expected Salary", type: "number", hideInTable: true },
        { name: "notice_period", label: "Notice Period", hideInTable: true },
        { name: "resume_url", label: "Resume URL", hideInTable: true },
        { name: "source", label: "Source" },
        { name: "stage", label: "Stage", type: "select", options: stages, default: "lead_received" },
        { name: "notes", label: "Notes", type: "textarea", hideInTable: true },
      ]}
    />
  );
}
