export interface ImportFieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "email";
  required?: boolean;
  enum?: string[];
}

export interface ImportSchema {
  key: string;
  label: string;
  table: string;
  /** Field used for duplicate detection / upsert match */
  uniqueField: string;
  fields: ImportFieldDef[];
}

export const IMPORT_SCHEMAS: Record<string, ImportSchema> = {
  clients: {
    key: "clients",
    label: "Clients",
    table: "clients",
    uniqueField: "company_name",
    fields: [
      { name: "company_name", label: "Company Name", required: true },
      { name: "contact_person", label: "Contact Person" },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email", type: "email" },
      { name: "active_positions", label: "Active Positions", type: "number" },
      { name: "agreement_type", label: "Agreement Type", enum: ["contingent", "retained", "rpo"] },
      { name: "billing_model", label: "Billing Model", enum: ["percentage", "flat", "monthly"] },
      { name: "status", label: "Status", enum: ["active", "inactive"] },
    ],
  },
  jobs: {
    key: "jobs",
    label: "Job Openings",
    table: "job_openings",
    uniqueField: "job_title",
    fields: [
      { name: "job_title", label: "Job Title", required: true },
      { name: "client_id", label: "Client ID" },
      { name: "location", label: "Location" },
      { name: "salary_min", label: "Salary Min", type: "number" },
      { name: "salary_max", label: "Salary Max", type: "number" },
      { name: "open_positions", label: "Open Positions", type: "number" },
      { name: "priority", label: "Priority", enum: ["low", "medium", "high", "urgent"] },
      { name: "status", label: "Status", enum: ["open", "on_hold", "closed"] },
    ],
  },
  candidates: {
    key: "candidates",
    label: "Candidates",
    table: "candidates",
    uniqueField: "email",
    fields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "mobile", label: "Mobile" },
      { name: "location", label: "Location" },
      { name: "position_applied", label: "Position Applied" },
      { name: "current_company", label: "Current Company" },
      { name: "experience_years", label: "Experience (Years)", type: "number" },
      { name: "current_salary", label: "Current Salary", type: "number" },
      { name: "expected_salary", label: "Expected Salary", type: "number" },
      { name: "notice_period", label: "Notice Period" },
      { name: "source", label: "Source" },
      { name: "stage", label: "Stage", enum: [
        "lead_received","contacted","interested","resume_collected","submitted_to_client",
        "interview_scheduled","interview_completed","selected","offer_released","joined","rejected","dropped"
      ]},
      { name: "notes", label: "Notes" },
    ],
  },
  submissions: {
    key: "submissions",
    label: "Submissions",
    table: "submissions",
    uniqueField: "candidate_id",
    fields: [
      { name: "candidate_id", label: "Candidate ID", required: true },
      { name: "client_id", label: "Client ID" },
      { name: "job_id", label: "Job ID" },
      { name: "role_title", label: "Role Title" },
      { name: "submission_date", label: "Submission Date", type: "date" },
      { name: "status", label: "Status", enum: ["submitted", "shortlisted", "rejected", "on_hold"] },
      { name: "remarks", label: "Remarks" },
    ],
  },
  interviews: {
    key: "interviews",
    label: "Interviews",
    table: "interviews",
    uniqueField: "candidate_id",
    fields: [
      { name: "candidate_id", label: "Candidate ID", required: true },
      { name: "client_id", label: "Client ID" },
      { name: "round", label: "Round", enum: ["screening","technical","managerial","hr","final"] },
      { name: "interview_date", label: "Interview Date", type: "date" },
      { name: "interview_time", label: "Interview Time", type: "time" },
      { name: "mode", label: "Mode", enum: ["online","f2f","phone"] },
      { name: "status", label: "Status", enum: ["scheduled","completed","selected","rejected","no_show"] },
      { name: "feedback", label: "Feedback" },
    ],
  },
  offers: {
    key: "offers",
    label: "Offers & Joining",
    table: "offers",
    uniqueField: "candidate_id",
    fields: [
      { name: "candidate_id", label: "Candidate ID", required: true },
      { name: "client_id", label: "Client ID" },
      { name: "offer_date", label: "Offer Date", type: "date" },
      { name: "joining_date", label: "Joining Date", type: "date" },
      { name: "salary", label: "Salary", type: "number" },
      { name: "ctc", label: "CTC", type: "number" },
      { name: "offer_status", label: "Offer Status", enum: ["pending","released","accepted","declined"] },
      { name: "joining_status", label: "Joining Status", enum: ["pending","joined","no_show"] },
    ],
  },
  billing: {
    key: "billing",
    label: "Billing",
    table: "billing",
    uniqueField: "invoice_number",
    fields: [
      { name: "invoice_number", label: "Invoice Number" },
      { name: "candidate_id", label: "Candidate ID" },
      { name: "client_id", label: "Client ID" },
      { name: "invoice_date", label: "Invoice Date", type: "date" },
      { name: "salary", label: "Salary", type: "number" },
      { name: "placement_fee", label: "Placement Fee", type: "number" },
      { name: "gst", label: "GST", type: "number" },
      { name: "invoice_amount", label: "Invoice Amount", type: "number" },
      { name: "outstanding_amount", label: "Outstanding Amount", type: "number" },
      { name: "payment_status", label: "Payment Status", enum: ["unpaid","partial","paid","overdue"] },
    ],
  },
};
