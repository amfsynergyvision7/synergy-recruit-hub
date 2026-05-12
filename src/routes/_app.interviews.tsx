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
        { name: "candidate_id", label: "Candidate ID", required: true },
        { name: "client_id", label: "Client ID" },
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
