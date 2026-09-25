import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { StatusPill, type PillTone } from "@/components/StatusPill";

export const Route = createFileRoute("/_app/offers")({ component: Page });

const OFFER_STATUS_TONE: Record<string, PillTone> = {
  pending: "warn",
  released: "info",
  accepted: "ok",
  declined: "bad",
};

const JOINING_STATUS_TONE: Record<string, PillTone> = {
  pending: "warn",
  joined: "ok",
  no_show: "bad",
};

function Page() {
  return (
    <CrudModule
      title="Offers & Joining"
      description="Track offers released and joinings. Auto-updates pipeline & billing."
      table="offers"
      module="offers"
      fields={[
        { name: "candidate_uuid", label: "Candidate", required: true, type: "relation", relation: { table: "candidates", select: "id, full_name, candidate_code, email, expected_salary, current_salary, assigned_recruiter", label: (r) => `${r.full_name} (${r.candidate_code ?? "No code"})`, description: (r) => r.email ?? "" } },
        { name: "client_uuid", label: "Client", type: "relation", relation: { table: "clients", select: "id, company_name, contact_person, email", label: (r) => r.company_name, description: (r) => r.contact_person ?? r.email ?? "" } },
        { name: "interview_uuid", label: "Selected Interview", hideInTable: true, type: "relation", relation: { table: "interviews", select: "id, round, status, interview_date", label: (r) => `${r.round ?? "Interview"} (${r.status ?? "status"})`, description: (r) => r.interview_date ?? "" } },
        { name: "offer_date", label: "Offer Date", type: "date" },
        { name: "joining_date", label: "Joining Date", type: "date" },
        { name: "salary", label: "Salary", type: "number" },
        { name: "ctc", label: "CTC", type: "number" },
        {
          name: "offer_status",
          label: "Offer Status",
          type: "select",
          options: [
            { value:"pending", label:"Pending" },{ value:"released", label:"Released" },
            { value:"accepted", label:"Accepted" },{ value:"declined", label:"Declined" }
          ],
          default: "pending",
          essential: true,
          render: (row) =>
            row.offer_status ? (
              <StatusPill label={String(row.offer_status).replace(/_/g, " ")} tone={OFFER_STATUS_TONE[row.offer_status] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
        {
          name: "joining_status",
          label: "Joining Status",
          type: "select",
          options: [
            { value:"pending", label:"Pending" },{ value:"joined", label:"Joined" },{ value:"no_show", label:"No Show" }
          ],
          default: "pending",
          essential: true,
          render: (row) =>
            row.joining_status ? (
              <StatusPill label={String(row.joining_status).replace(/_/g, " ")} tone={JOINING_STATUS_TONE[row.joining_status] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}