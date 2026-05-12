import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";

export const Route = createFileRoute("/_app/billing")({ component: Page });

function Page() {
  return (
    <CrudModule
      title="Billing & Invoices"
      description="Track invoices, placement fees, GST and payment status."
      table="billing"
      module="billing"
      searchFields={["invoice_number","payment_status"]}
      fields={[
        { name: "invoice_number", label: "Invoice #", hideInForm: true },
        { name: "candidate_id", label: "Candidate ID" },
        { name: "client_id", label: "Client ID" },
        { name: "invoice_date", label: "Invoice Date", type: "date" },
        { name: "salary", label: "Salary", type: "number" },
        { name: "placement_fee", label: "Placement Fee", type: "number" },
        { name: "gst", label: "GST", type: "number" },
        { name: "invoice_amount", label: "Invoice Amount", type: "number" },
        { name: "outstanding_amount", label: "Outstanding", type: "number" },
        { name: "payment_status", label: "Status", type: "select", options: [
          { value:"unpaid", label:"Unpaid" },{ value:"partial", label:"Partial" },{ value:"paid", label:"Paid" },{ value:"overdue", label:"Overdue" }
        ], default: "unpaid" },
      ]}
    />
  );
}
