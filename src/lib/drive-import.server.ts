// "Check Google Drive for new resumes" — bulk import.
//
// Point this at one shared, publicly-viewable Google Drive folder (the one
// you keep dropping new resumes into after a job-board post) and it will:
//   1. List every file currently in that folder.
//   2. Skip any file it has already imported before (see "already imported"
//      below) — so re-running this after adding 3 new resumes to a folder of
//      50 only ever processes those 3, not all 50 again.
//   3. For each genuinely new resume, download + parse the text (reusing
//      the exact same PDF/Word parser as Deep Match and Resume Summary —
//      still zero Supabase Storage used, the file is never saved anywhere)
//      and ask Gemini to pull out name, email, mobile, last job role, and
//      years of experience.
//   4. Check whether that person already exists in the CRM (by email, then
//      phone, then exact full name) and either fills in blanks on their
//      existing record, or creates a brand new candidate.
//
// Design choices, matching what was explicitly agreed before building this:
//   - Never overwrites a field that's already filled in on an existing
//     candidate — only ever fills in blanks. A manually-corrected value is
//     never clobbered by a bulk re-scan.
//   - "Last job role" is written into the existing position_applied field
//     (there's no separate "current title" field) — meaning that field can
//     now hold either "position applied for" (entered manually) or "last
//     job role" (pulled from a resume), depending on how the candidate was
//     added. source is set to "Google Drive Bulk Import" on auto-created
//     rows specifically so you can tell which is which later.
//   - Every mandatory field (name, email, mobile, last role, resume link)
//     is guaranteed to be non-empty after this runs: "NA" is written in
//     when nothing could be determined. experience_years is a numeric
//     column, so there "NA" isn't possible — it's left blank (NULL) instead
//     and shows as "—" in the table.
import { extractDriveFileId, fetchDriveBytes, extractText } from "./resume-fetch.server";
import { extractCandidateFieldsFromResume } from "./ai.server";

const DRIVE_LIST_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

// Only these are ever downloaded/parsed. Anything else (images, Google Docs
// native files, spreadsheets, etc.) is reported as skipped rather than
// silently ignored, so a genuinely-relevant file that got missed is visible.
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Keeps one run bounded in both wall-clock time (Vercel's function limit)
// and Gemini free-tier request volume. If a folder has more new resumes
// than this, running "Check Google Drive" again picks up right where this
// run left off, because already-processed files are skipped on the next
// pass (see "already imported" below).
const MAX_FILES_PER_RUN = 60;

// How many resumes are downloaded + sent to Gemini at once. Kept modest
// (rather than e.g. 10+) because Gemini's free tier has a real per-minute
// request cap — if a run reports several "Gemini API 429" failures, that's
// this limit being hit; just run "Check Google Drive" again afterwards, the
// files that succeeded won't be reprocessed.
const CONCURRENCY = 3;

function extractDriveFolderId(url: string): string | null {
  // Covers the common folder link shapes:
  //   https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  //   https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  return match?.[1] ?? null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

async function listFolderFiles(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      key: apiKey,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_LIST_ENDPOINT}?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data?.error?.message ?? `Drive API ${res.status}`;
      throw new Error(
        `Couldn't list the Drive folder (${message}). Check that DRIVE_API_KEY is set, the Drive API is enabled for that key's Google Cloud project, and the folder is shared "Anyone with the link — Viewer".`,
      );
    }
    for (const f of data?.files ?? []) {
      if (f?.id && f?.name && f?.mimeType && f?.webViewLink) {
        files.push({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: f.webViewLink });
      }
    }
    pageToken = data?.nextPageToken;
  } while (pageToken && files.length < 2000); // hard safety cap regardless of folder size

  return files;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Compare on the last 10 digits so +91-prefixed, 0-prefixed, and bare
  // 10-digit numbers all match each other.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

function withNA(value: string | null): string {
  return value && value.trim().length > 0 ? value.trim() : "NA";
}

interface CandidateRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  position_applied: string | null;
  experience_years: number | null;
  resume_url: string | null;
}

export type DriveImportFileOutcome =
  | { status: "created"; fileName: string; candidateName: string }
  | { status: "updated"; fileName: string; candidateName: string; fieldsFilled: string[] }
  | { status: "failed"; fileName: string; reason: string }
  | { status: "skipped_unsupported_format"; fileName: string };

export interface DriveImportSummary {
  totalInFolder: number;
  alreadyImported: number;
  skippedUnsupportedFormat: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  remaining: number; // new files found but not processed this run, due to MAX_FILES_PER_RUN
  outcomes: DriveImportFileOutcome[];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runResumeDriveImport(supabase: any): Promise<DriveImportSummary> {
  const apiKey = process.env.DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DRIVE_API_KEY is not configured. Add a Google Cloud API key with the Drive API enabled as an environment variable and redeploy.",
    );
  }

  const { data: settings, error: settingsError } = await supabase
    .from("app_settings")
    .select("resume_import_folder_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw settingsError;

  const folderUrl = settings?.resume_import_folder_url;
  if (!folderUrl) {
    throw new Error('No Google Drive folder is configured yet — set one under Settings → "Resume Import Folder" first.');
  }
  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId) {
    throw new Error("Couldn't find a folder ID in the configured Drive URL — check it's a normal folder share link.");
  }

  const allFiles = await listFolderFiles(folderId, apiKey);

  const { data: candidatesData, error: candError } = await supabase
    .from("candidates")
    .select("id, full_name, email, mobile, position_applied, experience_years, resume_url")
    .limit(5000);
  if (candError) throw candError;
  const candidates: CandidateRecord[] = candidatesData ?? [];

  // "Already imported" = the file's Drive ID matches the file ID embedded in
  // some candidate's saved resume_url. Comparing by file ID (not raw string)
  // means it doesn't matter whether that link was saved in the
  // /file/d/.../view form (what this feature writes) or the /uc?id=... form
  // (what may have been pasted in manually) — both resolve to the same ID.
  const alreadyImportedFileIds = new Set<string>();
  for (const c of candidates) {
    const id = extractDriveFileId(c.resume_url ?? "");
    if (id) alreadyImportedFileIds.add(id);
  }

  const byEmail = new Map<string, CandidateRecord>();
  const byPhone = new Map<string, CandidateRecord>();
  const byName = new Map<string, CandidateRecord>();
  for (const c of candidates) {
    const email = normalizeEmail(c.email);
    if (email && !byEmail.has(email)) byEmail.set(email, c);
    const phone = normalizePhone(c.mobile);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, c);
    // Never index a candidate whose name is missing/"NA" — otherwise every
    // NA-named candidate would falsely "match" every other one.
    const name = normalizeName(c.full_name);
    if (name && name !== "na" && !byName.has(name)) byName.set(name, c);
  }

  const unsupported = allFiles.filter((f) => !SUPPORTED_MIME_TYPES.has(f.mimeType));
  const supported = allFiles.filter((f) => SUPPORTED_MIME_TYPES.has(f.mimeType));
  const newFiles = supported.filter((f) => !alreadyImportedFileIds.has(f.id));

  const toProcess = newFiles.slice(0, MAX_FILES_PER_RUN);
  const remaining = newFiles.length - toProcess.length;

  const outcomes = await mapWithConcurrency(toProcess, CONCURRENCY, async (file): Promise<DriveImportFileOutcome> => {
    try {
      const downloaded = await fetchDriveBytes(file.id);
      if ("error" in downloaded) {
        return { status: "failed", fileName: file.name, reason: downloaded.error };
      }
      const parsed = await extractText(downloaded.buffer, downloaded.contentType);
      if (!parsed.ok) {
        return { status: "failed", fileName: file.name, reason: parsed.error };
      }

      const extracted = await extractCandidateFieldsFromResume(parsed.text);

      const emailKey = normalizeEmail(extracted.email);
      const phoneKey = normalizePhone(extracted.mobile);
      const nameKey = normalizeName(extracted.fullName);
      const match =
        (emailKey && byEmail.get(emailKey)) ||
        (phoneKey && byPhone.get(phoneKey)) ||
        (nameKey && nameKey !== "na" && byName.get(nameKey)) ||
        null;

      if (match) {
        const updates: Record<string, string | number> = {};
        const fieldsFilled: string[] = [];

        if (!match.full_name || match.full_name.trim() === "") { updates.full_name = withNA(extracted.fullName); fieldsFilled.push("full_name"); }
        if (!match.email || match.email.trim() === "") { updates.email = withNA(extracted.email); fieldsFilled.push("email"); }
        if (!match.mobile || match.mobile.trim() === "") { updates.mobile = withNA(extracted.mobile); fieldsFilled.push("mobile"); }
        if (!match.position_applied || match.position_applied.trim() === "") { updates.position_applied = withNA(extracted.lastRole); fieldsFilled.push("position_applied"); }
        if (match.experience_years == null && extracted.experienceYears != null) { updates.experience_years = extracted.experienceYears; fieldsFilled.push("experience_years"); }
        if (!match.resume_url || match.resume_url.trim() === "") { updates.resume_url = file.webViewLink; fieldsFilled.push("resume_url"); }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase.from("candidates").update(updates).eq("id", match.id);
          if (updateError) return { status: "failed", fileName: file.name, reason: updateError.message };
        }
        // Keep the in-memory record consistent in case a later file in this
        // same run also matches this candidate.
        Object.assign(match, updates);

        return { status: "updated", fileName: file.name, candidateName: match.full_name ?? "NA", fieldsFilled };
      }

      const insertPayload = {
        full_name: withNA(extracted.fullName),
        email: withNA(extracted.email),
        mobile: withNA(extracted.mobile),
        position_applied: withNA(extracted.lastRole),
        experience_years: extracted.experienceYears,
        resume_url: file.webViewLink,
        source: "Google Drive Bulk Import",
        stage: "lead_received",
      };
      const { data: inserted, error: insertError } = await supabase
        .from("candidates")
        .insert(insertPayload)
        .select("id, full_name, email, mobile, position_applied, experience_years, resume_url")
        .single();
      if (insertError) return { status: "failed", fileName: file.name, reason: insertError.message };

      // A newly created candidate is now a valid dedupe target for any other
      // file later in this same run (e.g. two resumes from the same person).
      const created: CandidateRecord = inserted;
      const createdEmail = normalizeEmail(created.email);
      if (createdEmail) byEmail.set(createdEmail, created);
      const createdPhone = normalizePhone(created.mobile);
      if (createdPhone) byPhone.set(createdPhone, created);
      const createdName = normalizeName(created.full_name);
      if (createdName && createdName !== "na") byName.set(createdName, created);

      return { status: "created", fileName: file.name, candidateName: created.full_name ?? "NA" };
    } catch (err: any) {
      return { status: "failed", fileName: file.name, reason: err?.message ?? "Unknown error" };
    }
  });

  const unsupportedOutcomes: DriveImportFileOutcome[] = unsupported.map((f) => ({
    status: "skipped_unsupported_format",
    fileName: f.name,
  }));
  const allOutcomes = [...outcomes, ...unsupportedOutcomes];

  return {
    totalInFolder: allFiles.length,
    alreadyImported: supported.length - newFiles.length,
    skippedUnsupportedFormat: unsupported.length,
    processed: outcomes.length,
    created: outcomes.filter((o) => o.status === "created").length,
    updated: outcomes.filter((o) => o.status === "updated").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    remaining,
    outcomes: allOutcomes,
  };
}