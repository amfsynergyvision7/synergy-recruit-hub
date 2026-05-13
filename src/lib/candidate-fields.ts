export const CANDIDATE_FIELDS = [
  "full_name", "mobile", "email", "location", "position_applied",
  "current_company", "experience_years", "current_salary", "expected_salary",
  "notice_period", "source", "resume_url", "notes",
] as const;

export const CANDIDATE_FIELD_LABELS: Record<(typeof CANDIDATE_FIELDS)[number], string> = {
  full_name: "Full Name",
  mobile: "Mobile",
  email: "Email",
  location: "Location",
  position_applied: "Position",
  current_company: "Current Company",
  experience_years: "Experience (yrs)",
  current_salary: "Current Salary",
  expected_salary: "Expected Salary",
  notice_period: "Notice Period",
  source: "Source",
  resume_url: "Resume URL",
  notes: "Notes",
};
