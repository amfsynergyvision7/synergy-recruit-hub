// Server-only Gemini API access. GEMINI_API_KEY must be set as a server
// environment variable (Vercel project settings, same place SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY / GOOGLE_SHEETS_API_KEY already live) — it is
// never read or referenced from client-side code, so it can't end up in the
// browser bundle. Get a free key at https://aistudio.google.com/apikey and
// the "gemini-3.5-flash" model used below is free-of-charge on the standard
// tier for text in/out as of this writing.
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

async function callGeminiJSON<T>(input: string, schema: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Add it as an environment variable and redeploy.");
  }
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input,
      response_format: { type: "text", mime_type: "application/json", schema },
    }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  const outputText = data?.output_text;
  if (!outputText) throw new Error("Gemini returned no output.");
  try {
    return JSON.parse(outputText) as T;
  } catch {
    throw new Error("Gemini returned a response that wasn't valid JSON.");
  }
}

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          score: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["candidate_id", "score", "reason"],
      },
    },
  },
  required: ["matches"],
};

// Matched against at most this many candidates per run, to keep the prompt
// (and free-tier token usage) bounded regardless of how large the pipeline
// grows — the most recently updated active candidates are the most likely
// to be relevant anyway.
const MAX_CANDIDATES = 40;

interface JobRow {
  id: string;
  job_title: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  priority: string | null;
  requirements: string | null;
}

interface CandidateRow {
  id: string;
  full_name: string;
  candidate_code: string | null;
  position_applied: string | null;
  current_company: string | null;
  experience_years: number | null;
  expected_salary: number | null;
  notice_period: string | null;
  notes: string | null;
}

function buildMatchPrompt(job: JobRow, candidates: CandidateRow[]): string {
  const jobBlock = [
    `Title: ${job.job_title}`,
    job.location ? `Location: ${job.location}` : null,
    job.salary_min != null || job.salary_max != null
      ? `Salary range: ${job.salary_min ?? "?"} - ${job.salary_max ?? "?"}`
      : null,
    job.priority ? `Priority: ${job.priority}` : null,
    job.requirements
      ? `Requirements / key skills:\n${job.requirements}`
      : "Requirements: (not specified — judge on role/title/seniority relevance instead)",
  ].filter(Boolean).join("\n");

  const candidateBlocks = candidates.map((c) =>
    [
      `id: ${c.id}`,
      `name: ${c.full_name}`,
      c.position_applied ? `applied for: ${c.position_applied}` : null,
      c.current_company ? `current company: ${c.current_company}` : null,
      c.experience_years != null ? `experience: ${c.experience_years} years` : null,
      c.expected_salary != null ? `expected salary: ${c.expected_salary}` : null,
      c.notice_period ? `notice period: ${c.notice_period}` : null,
      c.notes ? `notes: ${c.notes}` : null,
    ].filter(Boolean).join(", "),
  ).join("\n---\n");

  return [
    "You are a recruiting assistant. Score how well each candidate below fits the job opening, on a 0-100 scale (100 = excellent fit).",
    "Give one short, specific reason (max 20 words) per candidate, referencing concrete details from their profile against the job.",
    "Be honest and differentiate the scores — do not give every candidate a similar score.",
    "",
    "JOB OPENING:",
    jobBlock,
    "",
    "CANDIDATES:",
    candidateBlocks,
    "",
    "Return exactly one match entry per candidate id listed above.",
  ].join("\n");
}

export interface CandidateMatch {
  candidateId: string;
  fullName: string;
  candidateCode: string | null;
  positionApplied: string | null;
  score: number;
  reason: string;
}

export async function matchCandidatesToJob(supabase: any, jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from("job_openings")
    .select("id, job_title, location, salary_min, salary_max, priority, requirements")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error("Job not found.");

  const { data: candidates, error: candError } = await supabase
    .from("candidates")
    .select("id, full_name, candidate_code, position_applied, current_company, experience_years, expected_salary, notice_period, notes, stage")
    .not("stage", "in", "(rejected,dropped)")
    .order("updated_at", { ascending: false })
    .limit(MAX_CANDIDATES);
  if (candError) throw candError;

  if (!candidates || candidates.length === 0) {
    return { job, matches: [] as CandidateMatch[], consideredCount: 0 };
  }

  const prompt = buildMatchPrompt(job as JobRow, candidates as CandidateRow[]);
  const result = await callGeminiJSON<{ matches: { candidate_id: string; score: number; reason: string }[] }>(prompt, MATCH_SCHEMA);

  const byId = new Map<string, CandidateRow>(candidates.map((c: CandidateRow) => [c.id, c]));
  const matches: CandidateMatch[] = (result.matches ?? [])
    .map((m) => {
      const candidate = byId.get(m.candidate_id);
      if (!candidate) return null;
      return {
        candidateId: candidate.id,
        fullName: candidate.full_name,
        candidateCode: candidate.candidate_code,
        positionApplied: candidate.position_applied,
        score: Math.max(0, Math.min(100, Math.round(m.score))),
        reason: m.reason,
      };
    })
    .filter((m): m is CandidateMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  return { job, matches, consideredCount: candidates.length };
}