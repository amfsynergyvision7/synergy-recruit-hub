import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { StatusPill, type PillTone } from "@/components/StatusPill";

export const Route = createFileRoute("/_app/clients")({ component: Page });

const STATUS_TONE: Record<string, PillTone> = {
  active: "ok",
  inactive: "neutral",
};

function Page() {
  return (
    <CrudModule
      title="Clients"
      description="Manage client companies and engagement details."
      table="clients"
      module="clients"
      searchFields={["company_name","contact_person","email"]}
      fields={[
        { name: "company_name", label: "Company", required: true },
        { name: "contact_person", label: "Contact", essential: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "active_positions", label: "Active Positions", type: "number" },
        { name: "agreement_type", label: "Agreement", type: "select", options: [
          { value:"contingent", label:"Contingent" },{ value:"retained", label:"Retained" },{ value:"rpo", label:"RPO" }
        ]},
        { name: "billing_model", label: "Billing", type: "select", options: [
          { value:"percentage", label:"% of CTC" },{ value:"flat", label:"Flat Fee" },{ value:"monthly", label:"Monthly" }
        ]},
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value:"active", label:"Active" },{ value:"inactive", label:"Inactive" }
          ],
          default: "active",
          essential: true,
          render: (row) =>
            row.status ? (
              <StatusPill label={String(row.status)} tone={STATUS_TONE[row.status] ?? "neutral"} />
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}