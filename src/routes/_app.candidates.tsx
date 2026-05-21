import { createFileRoute } from "@tanstack/react-router";
import { CrudModule } from "@/components/CrudModule";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/candidates")({ component: Page });

const stages = [
  "lead_received","contacted","interested","resume_collected","submitted_to_client",
  "interview_scheduled","interview_completed","selected","offer_released","joined","rejected","dropped"
].map(v => ({ value: v, label: v.replace(/_/g," ") }));

function Page() {
  const [recruiters, setRecruiters] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const fetchRecruiters = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('status', 'approved')
        .order('full_name');
      
      if (!error && data) {
        setRecruiters(data.map((recruiter: { id: string; full_name: string; email: string }) => ({
          value: recruiter.id,
          label: recruiter.full_name || recruiter.email
        })));
      }
    };
    
    fetchRecruiters();
  }, []);

  return (
    <CrudModule
      title="Candidates"
      description="Full candidate pipeline with automated stage tracking."
      table="candidates"
      module="candidates"
      searchFields={["full_name","email","mobile","candidate_code","position_applied"]}
      fields={[
        { name: "candidate_code", label: "Code", hideInForm: true },
        { name: "full_name", label: "Full Name", required: true },
        { name: "mobile", label: "Mobile", type: "tel" },
        { name: "email", label: "Email", type: "email" },
        { name: "location", label: "Location" },
        { name: "position_applied", label: "Position" },
        { name: "current_company", label: "Current Company", hideInTable: true },
        { name: "experience_years", label: "Experience (yrs)", type: "number" },
        { name: "current_salary", label: "Current Salary", type: "number", hideInTable: true },
        { name: "expected_salary", label: "Expected Salary", type: "number", hideInTable: true },
        { name: "notice_period", label: "Notice Period", hideInTable: true },
        { name: "resume_url", label: "Resume URL", hideInTable: true },
        { name: "source", label: "Source" },
        { name: "stage", label: "Stage", type: "select", options: stages, default: "lead_received" },
        { 
          name: "assigned_recruiter", 
          label: "Assigned Recruiter", 
          type: "select", 
          options: recruiters
        },
        { name: "notes", label: "Notes", type: "textarea", hideInTable: true },
      ]}
    />
  );
}