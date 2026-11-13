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
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { downloadRemoteBounded } from "./safe-remote-download.server";

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
// pass (see "already imported" below). Lowered from 100 back down to 20
// after a 29-file run came back as a bare "Failed to fetch" — Vercel killed
// the connection mid-run, almost certainly because this project's actual
// deployed function-duration limit is shorter than the platform's current
// documented default (older projects don't always pick up a raised default
// automatically). A smaller batch finishes well within a conservative
// window regardless of exactly what that limit turns out to be; raising
// "Function Max Duration" in Vercel's project settings is the other half
// of this fix and lets this number safely go back up later if wanted.
const MAX_FILES_PER_RUN = 20;

// How many resumes are downloaded + sent to Gemini at once. This was capped
// at 3 while the model had only a 5 requests/minute free-tier ceiling; now
// that it allows 15/minute, 5 concurrent still leaves headroom for whatever
// else (matching, resume summaries) might be calling Gemini around the same
// time. If a run ever reports several "Gemini API 429" failures again,
// that's this limit being hit — just run "Check Google Drive" again
// afterwards, the files that already succeeded won't be reprocessed.
const CONCURRENCY = 5;

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

    // Google APIs can emit unbounded JSON or echo the key/folder/PII in
    // error bodies. Read a maximum of 2 MB from the exact Google API host.
    // Never follow a redirect to an unapproved endpoint with the API key.
    let data: any;
    try {
      const result = await downloadRemoteBounded(`${DRIVE_LIST_ENDPOINT}?${params.toString()}`, {
        allowedHost: host => host === "www.googleapis.com",
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 10000,
        maxRedirects: 0,
      });
      data = JSON.parse(result.body.toString("utf8"));
      if (!data || !Array.isArray(data.files)) throw new Error("Invalid Drive response");
    } catch {
      throw new Error("Drive folder listing unavailable; review restricted connector diagnostics.");
    }
    for (const f of data?.files ?? []) {
      if (f?.id && f?.name && f?.mimeType && f?.webViewLink) {
        files.push({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: f.webViewLink });
      }
    }
    const nextToken = data?.nextPageToken;
    if (nextToken !== undefined && nextToken !== null &&
        (typeof nextToken !== "string" || nextToken.length > 2048 ||
         !new RegExp("^[A-Za-z0-9._+/=-]+$").test(nextToken))) {
      throw new Error("Drive pagination response is invalid");
    }
    pageToken = nextToken ?? undefined;
  } while (pageToken && files.length < 2000); // hard safety cap regardless of folder size

  return files;
}

export type DriveImportFileOutcome =
  | { status: "created"; fileName: string; candidateName: string }
  | { status: "updated"; fileName: string; candidateName: string; fieldsFilled: string[] }
  | { status: "already_imported"; fileName: string }
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
  remaining: number;
  outcomes: DriveImportFileOutcome[];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function assertDriveBulkImportReviewed(): void {
  // This unconditional server-side hold cannot be bypassed by a browser,
  // environment flag, or a direct function call.
  throw new Error("Drive bulk import paused pending transactional idempotency approval");
}

/**
 * Review-branch implementation of Drive import using one atomic
 * PostgreSQL RPC per file. Until independent review and release acceptance,
 * assertDriveBulkImportReviewed() always denies before credentials/network.
 */
export async function runResumeDriveImport(supabase: any, ownerId: string): Promise<DriveImportSummary> {
  assertDriveBulkImportReviewed();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error("Drive import owner is invalid");
  }
  const recruiterId = process.env.CANDIDATE_SYNC_ASSIGNED_RECRUITER_ID;
  if (!recruiterId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(recruiterId)) {
    throw new Error("Drive import requires an approved recruiter configuration");
  }
  const apiKey = process.env.DRIVE_API_KEY;
  if (!apiKey) throw new Error("Drive API credentials are not configured");
  const { data: folderUrl, error: folderError } = await supabase.rpc("crm_admin_get_resume_folder");
  if (folderError || typeof folderUrl !== "string") throw new Error("Drive folder unavailable");
  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId) throw new Error("Drive folder link is invalid");

  const allFiles = await listFolderFiles(folderId, apiKey);
  // The source-of-truth import ledger is not directly selectable by browsers
  // or authenticated clients. This service-role RPC validates owner+folder.
  const { data: ledger, error: ledgerError } = await (supabaseAdmin as any).rpc(
    "crm_list_drive_imported_file_ids", { p_owner: ownerId, p_folder_id: folderId },
  );
  if (ledgerError || !Array.isArray(ledger)) throw new Error("Drive import ledger unavailable");
  const knownIds = new Set<string>(ledger
    .map((row: { file_id?: unknown }) => row?.file_id)
    .filter((id: unknown): id is string => typeof id === "string"));

  const unsupported = allFiles.filter(file => !SUPPORTED_MIME_TYPES.has(file.mimeType));
  const supported = allFiles.filter(file => SUPPORTED_MIME_TYPES.has(file.mimeType));
  const toImport = supported.filter(file => !knownIds.has(file.id));
  const toProcess = toImport.slice(0, MAX_FILES_PER_RUN);

  const outcomes = await mapWithConcurrency(toProcess, CONCURRENCY, async (file): Promise<DriveImportFileOutcome> => {
    try {
      const downloaded = await fetchDriveBytes(file.id);
      if ("error" in downloaded) return { status: "failed", fileName: file.name, reason: downloaded.error };
      const parsed = await extractText(downloaded.buffer, downloaded.contentType);
      if (!parsed.ok) return { status: "failed", fileName: file.name, reason: parsed.error };
      const extracted = await extractCandidateFieldsFromResume(parsed.text);
      const { data: committed, error: commitError } = await (supabaseAdmin as any).rpc(
        "crm_commit_drive_resume_import", {
          p_owner: ownerId,
          p_assigned_recruiter: recruiterId,
          p_folder_id: folderId,
          p_file_id: file.id,
          p_extracted: {
            full_name: extracted.fullName ?? null,
            email: extracted.email ?? null,
            mobile: extracted.mobile ?? null,
            position_applied: extracted.lastRole ?? null,
            experience_years: extracted.experienceYears ?? null,
          },
        },
      );
      if (commitError || !Array.isArray(committed) || committed.length !== 1) {
        throw new Error("Atomic Drive import commit unavailable; manual review required");
      }
      const outcome = committed[0]?.outcome;
      if (outcome === "replayed") return { status: "already_imported", fileName: file.name };
      if (outcome === "created") return { status: "created", fileName: file.name, candidateName: extracted.fullName ?? "" };
      if (outcome === "updated") {
        const filled = committed[0]?.fields_filled;
        return { status: "updated", fileName: file.name, candidateName: extracted.fullName ?? "", fieldsFilled: Array.isArray(filled) ? filled.filter((x: unknown): x is string => typeof x === "string") : [] };
      }
      throw new Error("Unknown Drive import commit result; manual review required");
    } catch {
      // The admin-facing result does not expose SQL internals, candidate data
      // or service credentials; case-level failure details remain in evidence.
      return { status: "failed", fileName: file.name, reason: "Drive import was not committed; review configuration and source data" };
    }
  });

  const unsupportedOutcomes: DriveImportFileOutcome[] = unsupported.map(file => ({
    status: "skipped_unsupported_format",
    fileName: file.name,
  }));
  const already = supported.length - toImport.length +
    outcomes.filter(o => o.status === "already_imported").length;
  return {
    totalInFolder: allFiles.length,
    alreadyImported: already,
    skippedUnsupportedFormat: unsupported.length,
    processed: outcomes.length,
    created: outcomes.filter(o => o.status === "created").length,
    updated: outcomes.filter(o => o.status === "updated").length,
    failed: outcomes.filter(o => o.status === "failed").length,
    remaining: toImport.length - toProcess.length,
    outcomes: [...outcomes, ...unsupportedOutcomes],
  };
}
