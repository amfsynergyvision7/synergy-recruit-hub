import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { StatusPill, type PillTone } from "@/components/StatusPill";

export const Route = createFileRoute("/_app/jobs")({ component: Page });

const STATUS_TONE: Record<string, PillTone> = {
  open: "ok",
  on_hold: "warn",
  closed: "neutral",
};

// Priority genuinely escalates (low -> urgent), unlike Round/Mode elsewhere,
// so a color ramp is meaningful here: urgent should visually alarm.
const PRIORITY_TONE: Record<string, PillTone> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  urgent: "bad",
};

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
        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: [
            { value:"low", label:"Low" },{ value:"medium", label:"Medium" },{ value:"high", label:"High" },{ value:"urgent", label:"Urgent" }
          ],
          default: "medium",
          essential: true,
          render: (row) =>
            row.priority ? (
              <StatusPill label={String(row.priority)} tone={PRIORITY_TONE[row.priority] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value:"open", label:"Open" },{ value:"on_hold", label:"On Hold" },{ value:"closed", label:"Closed" }
          ],
          default: "open",
          essential: true,
          render: (row) =>
            row.status ? (
              <StatusPill label={String(row.status).replace(/_/g, " ")} tone={STATUS_TONE[row.status] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}