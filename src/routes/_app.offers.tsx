import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/offers")({ component: Page });

function Page() {
  return (
    <CrudModule
      title="Offers & Joining"
      description="Track offers released and joinings. Auto-updates pipeline & billing."
      table="offers"
      module="offers"
      fields={[
        { name: "candidate_id", label: "Candidate ID", required: true },
        { name: "client_id", label: "Client ID" },
        { name: "offer_date", label: "Offer Date", type: "date" },
        { name: "joining_date", label: "Joining Date", type: "date" },
        { name: "salary", label: "Salary", type: "number" },
        { name: "ctc", label: "CTC", type: "number" },
        { name: "offer_status", label: "Offer Status", type: "select", options: [
          { value:"pending", label:"Pending" },{ value:"released", label:"Released" },
          { value:"accepted", label:"Accepted" },{ value:"declined", label:"Declined" }
        ], default: "pending" },
        { name: "joining_status", label: "Joining Status", type: "select", options: [
          { value:"pending", label:"Pending" },{ value:"joined", label:"Joined" },{ value:"no_show", label:"No Show" }
        ], default: "pending" },
      ]}
    />
  );
}
