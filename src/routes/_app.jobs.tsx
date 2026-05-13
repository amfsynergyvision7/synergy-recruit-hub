import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/jobs")({ component: Page });

function Page() {
  return (
    <CrudModule
      title="Job Openings"
      description="Track open positions and assignments."
      table="job_openings"
      module="jobs"
      searchFields={["job_title","location"]}
      fields={[
        { name: "job_title", label: "Title", required: true },
        { name: "client_uuid", label: "Client", type: "relation", relation: { table: "clients", select: "id, company_name, contact_person, email", label: (r) => r.company_name, description: (r) => r.contact_person ?? r.email ?? "" } },
        { name: "location", label: "Location" },
        { name: "salary_min", label: "Salary Min", type: "number" },
        { name: "salary_max", label: "Salary Max", type: "number" },
        { name: "open_positions", label: "Openings", type: "number", default: 1 },
        { name: "priority", label: "Priority", type: "select", options: [
          { value:"low", label:"Low" },{ value:"medium", label:"Medium" },{ value:"high", label:"High" },{ value:"urgent", label:"Urgent" }
        ], default: "medium" },
        { name: "status", label: "Status", type: "select", options: [
          { value:"open", label:"Open" },{ value:"on_hold", label:"On Hold" },{ value:"closed", label:"Closed" }
        ], default: "open" },
      ]}
    />
  );
}
