import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/interviews")({ component: Page });

function Page() {
  return (
    <CrudModule
      title="Interviews"
      description="Schedule and track interviews. Auto-syncs candidate stage."
      table="interviews"
      module="interviews"
      searchFields={["round","status","mode"]}
      fields={[
        { name: "candidate_uuid", label: "Candidate", required: true, type: "relation", relation: { table: "candidates", select: "id, full_name, candidate_code, email, position_applied", label: (r) => `${r.full_name} (${r.candidate_code ?? "No code"})`, description: (r) => r.email ?? r.position_applied ?? "" } },
        { name: "client_uuid", label: "Client", type: "relation", relation: { table: "clients", select: "id, company_name, contact_person, email", label: (r) => r.company_name, description: (r) => r.contact_person ?? r.email ?? "" } },
        { name: "submission_uuid", label: "Submission", hideInTable: true, type: "relation", relation: { table: "submissions", select: "id, role_title, status, submission_date", label: (r) => r.role_title ?? `Submission ${String(r.id).slice(0, 8)}`, description: (r) => [r.status, r.submission_date].filter(Boolean).join(" • ") } },
        { name: "round", label: "Round", type: "select", options: [
          { value:"screening", label:"Screening" },{ value:"technical", label:"Technical" },
          { value:"managerial", label:"Managerial" },{ value:"hr", label:"HR" },{ value:"final", label:"Final" }
        ]},
        { name: "interview_date", label: "Date", type: "date" },
        { name: "interview_time", label: "Time", type: "time" },
        { name: "mode", label: "Mode", type: "select", options: [
          { value:"online", label:"Online" },{ value:"f2f", label:"In Person" },{ value:"phone", label:"Phone" }
        ]},
        { name: "status", label: "Status", type: "select", options: [
          { value:"scheduled", label:"Scheduled" },{ value:"completed", label:"Completed" },
          { value:"selected", label:"Selected" },{ value:"rejected", label:"Rejected" },{ value:"no_show", label:"No Show" }
        ], default: "scheduled" },
        { name: "feedback", label: "Feedback", type: "textarea", hideInTable: true },
      ]}
    />
  );
}
