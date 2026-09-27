import { fetchResumeText } from "./resume-fetch.server";

// Server-only Gemini API access. GEMINI_API_KEY must be set as a server
// environment variable (Vercel project settings, same place SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY / GOOGLE_SHEETS_API_KEY already live) — it is
// never read or referenced from client-side code, so it can't end up in the
// browser bundle. Get a free key at https://aistudio.google.com/apikey and
// the "gemini-3.8-flash" model used below is free-of-charge on the standard
// tier for text in/out as of this writing.
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

// Google's own Interactions API docs are inconsistent about the response
// shape across pages: some show a top-level "output_text", some show it
// nested under "interaction.outputText" (SDK convenience wrapper), and the
// raw curl example shows the real text nested inside a "steps" array
// (steps[].content[].text), with no top-level "output_text" at all. Rather
// than trust one page, this checks every documented shape in order, so we
// keep working even if Google's raw REST response changes slightly again.
function extractOutputText(data: any): string | undefined {
  if (typeof data?.output_text === "string" && data.output_text.length > 0) return data.output_text;
  if (typeof data?.interaction?.outputText === "string" && data.interaction.outputText.length > 0) return data.interaction.outputText;
  if (typeof data?.interaction?.output_text === "string" && data.interaction.output_text.length > 0) return data.interaction.output_text;
  if (Array.isArray(data?.steps)) {
    for (const step of data.steps) {
      if (!Array.isArray(step?.content)) continue;
      for (const item of step.content) {
        if (typeof item?.text === "string" && item.text.length > 0) return item.text;
      }
    }
  }
  return undefined;
}

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
  const outputText = extractOutputText(data);
  if (!outputText) {
    // Include a slice of the raw response so this is debuggable in one shot
    // if Google's response shape ever drifts again, instead of a dead-end
    // generic message.
    const preview = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Gemini returned no recognizable output. Raw response: ${preview.slice(0, 500)}`);
  }
  try {
    return JSON.parse(outputText) as T;
  } catch {
    throw new Error(`Gemini returned a response that wasn't valid JSON: ${outputText.slice(0, 500)}`);
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
  description: string | null;
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
  resume_url?: string | null;
}

function buildJobBlock(job: JobRow): string {
  return [
    `Title: ${job.job_title}`,
    job.location ? `Location: ${job.location}` : null,
    job.salary_min != null || job.salary_max != null
      ? `Salary range: ${job.salary_min ?? "?"} - ${job.salary_max ?? "?"}`
      : null,
    job.priority ? `Priority: ${job.priority}` : null,
    job.description
      ? `Job description:\n${job.description}`
      : null,
    job.requirements
      ? `Requirements / key skills:\n${job.requirements}`
      : null,
    !job.description && !job.requirements
      ? "Job description / requirements: (not specified — judge on role/title/seniority relevance instead)"
      : null,
  ].filter(Boolean).join("\n");
}

function buildMatchPrompt(job: JobRow, candidates: CandidateRow[]): string {
  const jobBlock = buildJobBlock(job);

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
    .select("id, job_title, location, salary_min, salary_max, priority, description, requirements")
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

const DEEP_MATCH_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
  required: ["score", "summary", "strengths", "gaps"],
};

function buildDeepMatchPrompt(job: JobRow, candidate: CandidateRow, resumeText: string): string {
  const jobBlock = buildJobBlock(job);

  const candidateBlock = [
    `Name: ${candidate.full_name}`,
    candidate.position_applied ? `Applied for: ${candidate.position_applied}` : null,
    candidate.current_company ? `Current company: ${candidate.current_company}` : null,
    candidate.experience_years != null ? `Experience: ${candidate.experience_years} years` : null,
    candidate.expected_salary != null ? `Expected salary: ${candidate.expected_salary}` : null,
    candidate.notice_period ? `Notice period: ${candidate.notice_period}` : null,
    candidate.notes ? `CRM notes: ${candidate.notes}` : null,
  ].filter(Boolean).join("\n");

  return [
    "You are a recruiting assistant doing an in-depth review of one candidate's actual resume against a job opening.",
    "Score the fit on a 0-100 scale (100 = excellent fit), write a 2-3 sentence summary explaining the score, and list concrete strengths and gaps as short bullet phrases (3-6 words each) drawn from specifics in the resume text, not generic statements.",
    "",
    "JOB OPENING:",
    jobBlock,
    "",
    "CANDIDATE (CRM record):",
    candidateBlock,
    "",
    "CANDIDATE'S RESUME (extracted text):",
    resumeText,
  ].join("\n");
}

export interface DeepCandidateMatch {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export async function matchCandidateResume(supabase: any, jobId: string, candidateId: string) {
  const { data: job, error: jobError } = await supabase
    .from("job_openings")
    .select("id, job_title, location, salary_min, salary_max, priority, description, requirements")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new Error("Job not found.");

  const { data: candidate, error: candError } = await supabase
    .from("candidates")
    .select("id, full_name, candidate_code, position_applied, current_company, experience_years, expected_salary, notice_period, notes, resume_url")
    .eq("id", candidateId)
    .maybeSingle();
  if (candError) throw candError;
  if (!candidate) throw new Error("Candidate not found.");

  const resume = await fetchResumeText(candidate.resume_url ?? null);
  if (!resume.ok) {
    throw new Error(`Couldn't read this candidate's resume: ${resume.error}`);
  }

  const prompt = buildDeepMatchPrompt(job as JobRow, candidate as CandidateRow, resume.text);
  const result = await callGeminiJSON<DeepCandidateMatch>(prompt, DEEP_MATCH_SCHEMA);

  return {
    job,
    candidate,
    // Sent back alongside the score so the UI can show exactly what text was
    // pulled from the Drive file — the only real proof, for a human looking
    // at the result, that this actually read the resume rather than just
    // reusing the CRM fields.
    resumeText: resume.text,
    match: {
      score: Math.max(0, Math.min(100, Math.round(result.score))),
      summary: result.summary,
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      gaps: Array.isArray(result.gaps) ? result.gaps : [],
    } as DeepCandidateMatch,
  };
}

const RESUME_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
  },
  required: ["summary"],
};

function buildResumeSummaryPrompt(candidateName: string, resumeText: string): string {
  return [
    "You are a recruiting assistant. Write a concise, factual professional summary of the candidate below, based only on their resume text — not compared against any specific job.",
    "Cover their career trajectory, years of experience, key skills/tools, and the most notable achievements. 120-200 words. Do not invent anything not present in the resume text.",
    "",
    `CANDIDATE: ${candidateName}`,
    "",
    "RESUME TEXT:",
    resumeText,
  ].join("\n");
}

// Generates a standalone summary of a candidate's actual resume (independent
// of any one job) and saves it to candidates.resume_summary, so it can be
// read on the candidate's own record and reused as a fast reference without
// re-downloading and re-parsing the Drive file every time. Explicitly
// triggered by a "Generate Resume Summary" button — never runs automatically
// on save, since a resume fetch + Gemini call has a real, visible cost.
export async function generateResumeSummary(supabase: any, candidateId: string) {
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, full_name, resume_url")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw error;
  if (!candidate) throw new Error("Candidate not found.");

  const resume = await fetchResumeText(candidate.resume_url ?? null);
  if (!resume.ok) {
    throw new Error(`Couldn't read this candidate's resume: ${resume.error}`);
  }

  const prompt = buildResumeSummaryPrompt(candidate.full_name, resume.text);
  const result = await callGeminiJSON<{ summary: string }>(prompt, RESUME_SUMMARY_SCHEMA);

  const { error: updateError } = await supabase
    .from("candidates")
    .update({ resume_summary: result.summary })
    .eq("id", candidateId);
  if (updateError) throw updateError;

  return { summary: result.summary, resumeText: resume.text };
}

// ============ Drive-folder bulk import: structured field extraction ============
// Used by drive-import.server.ts (the "Check Google Drive for new resumes"
// feature) to pull the handful of CRM fields it needs out of each resume's
// raw text. Kept here, alongside every other Gemini prompt/schema in this
// file, rather than in drive-import.server.ts, which owns the Drive-listing
// and dedupe/write logic instead.
const CANDIDATE_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    mobile: { type: ["string", "null"] },
    last_role: { type: ["string", "null"] },
    experience_years: { type: ["number", "null"] },
  },
  required: ["full_name", "email", "mobile", "last_role", "experience_years"],
};

function buildCandidateExtractPrompt(resumeText: string): string {
  return [
    "You are a recruiting assistant. Extract the following fields from the resume text below, if present:",
    "- full_name: the candidate's full name",
    "- email: their email address",
    "- mobile: their mobile/phone number",
    "- last_role: their most recent (current or last) job title / designation — not the job they may be applying for, just their own professional title",
    "- experience_years: their total years of professional experience, as a plain number (e.g. 4.5), estimated from their work history if not explicitly stated",
    "",
    "Rules:",
    "- Return JSON with exactly these five keys: full_name, email, mobile, last_role, experience_years.",
    "- If a field genuinely cannot be determined from the text, use null for it — never guess or invent a value.",
    "- experience_years must be a plain number or null, never a string or a range.",
    "",
    "RESUME TEXT:",
    resumeText,
  ].join("\n");
}

export interface ExtractedCandidateFields {
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  lastRole: string | null;
  experienceYears: number | null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// Defensively re-validates every field regardless of what the schema above
// asked for — Gemini's own response shape has already proven inconsistent
// once this session (see extractOutputText), so this never trusts a raw
// field's type without checking it first.
export async function extractCandidateFieldsFromResume(resumeText: string): Promise<ExtractedCandidateFields> {
  const raw = await callGeminiJSON<Record<string, unknown>>(
    buildCandidateExtractPrompt(resumeText),
    CANDIDATE_EXTRACT_SCHEMA,
  );
  return {
    fullName: cleanString(raw.full_name),
    email: cleanString(raw.email),
    mobile: cleanString(raw.mobile),
    lastRole: cleanString(raw.last_role),
    experienceYears: cleanNumber(raw.experience_years),
  };
}