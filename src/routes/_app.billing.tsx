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
        { name: "candidate_uuid", label: "Candidate", type: "relation", relation: { table: "candidates", select: "id, full_name, candidate_code, email", label: (r) => `${r.full_name} (${r.candidate_code ?? "No code"})`, description: (r) => r.email ?? "" } },
        { name: "client_uuid", label: "Client", type: "relation", relation: { table: "clients", select: "id, company_name, contact_person, email", label: (r) => r.company_name, description: (r) => r.contact_person ?? r.email ?? "" } },
        { name: "offer_uuid", label: "Offer", hideInTable: true, type: "relation", relation: { table: "offers", select: "id, offer_status, joining_status, salary, ctc", label: (r) => `Offer ${String(r.id).slice(0, 8)}`, description: (r) => [r.offer_status, r.joining_status, r.salary ?? r.ctc].filter(Boolean).join(" • ") } },
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
