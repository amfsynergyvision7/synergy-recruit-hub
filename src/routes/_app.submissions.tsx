import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/submissions")({ component: Page });

function Page() {
  return (
    <CrudModule
      title="Submissions"
      description="Profiles submitted to clients. Auto-updates candidate stage."
      table="submissions"
      module="submissions"
      searchFields={["role_title","status"]}
      fields={[
        { name: "candidate_uuid", label: "Candidate", required: true, type: "relation", relation: { table: "candidates", select: "id, full_name, candidate_code, email, position_applied", label: (r) => `${r.full_name} (${r.candidate_code ?? "No code"})`, description: (r) => r.email ?? r.position_applied ?? "" } },
        { name: "client_uuid", label: "Client", type: "relation", relation: { table: "clients", select: "id, company_name, contact_person, email", label: (r) => r.company_name, description: (r) => r.contact_person ?? r.email ?? "" } },
        { name: "job_uuid", label: "Job", hideInTable: true, type: "relation", relation: { table: "job_openings", select: "id, job_title, location, status", label: (r) => r.job_title, description: (r) => [r.location, r.status].filter(Boolean).join(" • ") } },
        { name: "role_title", label: "Role" },
        { name: "submission_date", label: "Submitted On", type: "date" },
        { name: "status", label: "Status", type: "select", options: [
          { value:"submitted", label:"Submitted" },{ value:"shortlisted", label:"Shortlisted" },
          { value:"rejected", label:"Rejected" },{ value:"on_hold", label:"On Hold" }
        ], default: "submitted" },
        { name: "remarks", label: "Remarks", type: "textarea", hideInTable: true },
      ]}
    />
  );
}
