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
        { name: "candidate_id", label: "Candidate ID", required: true },
        { name: "client_id", label: "Client ID" },
        { name: "job_id", label: "Job ID", hideInTable: true },
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
