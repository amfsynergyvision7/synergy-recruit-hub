// Server-only: fetches a candidate's resume straight from the Google Drive
// link stored in resume_url, parses it into plain text, and hands the text
// back for scoring. Nothing here is ever saved anywhere — the file is
// downloaded, read into memory, parsed, and discarded on every call, so this
// costs zero Supabase storage. It only works because the Drive link is
// genuinely "Anyone with the link" — a link restricted to specific people
// will fail to download here the same way it would in an incognito browser.
import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import { downloadRemoteBounded, isTrustedDriveHost } from "./safe-remote-download.server";

// A resume that genuinely has no readable text (a scanned photo/image saved
// as a PDF, with no text layer at all) is a different, harder problem than
// what this file fixes — OCR isn't implemented. This threshold is how
// "basically nothing came out" is told apart from "a short but real resume",
// so the error message points at the right cause instead of just saying
// nothing came back.
const MIN_USABLE_CHARS = 40;

// Keeps the Gemini prompt (and free-tier token usage) bounded regardless of
// how long a resume is — a few thousand characters is plenty of signal.
const MAX_RESUME_CHARS = 8000;

export type ResumeFetchResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

// Exported (not just used internally) so the Drive-folder bulk-import
// feature (drive-import.server.ts) can share the exact same download/parse
// logic instead of duplicating it — a file downloaded via a folder listing
// and a file downloaded via a saved resume_url go through identical code
// from here on.
export function extractDriveFileId(raw: string): string | null {
  // Exact HTTPS origin checking stops drive.google.com.evil.example,
  // credentials, IP literals and arbitrary URL substring matches.
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" ||
        url.port || url.username || url.password) return null;
    const byPath = /^\/file\/d\/([a-zA-Z0-9_-]{10,})(?:\/|$)/.exec(url.pathname)?.[1];
    const queryId = (url.pathname === "/open" || url.pathname === "/uc")
      ? url.searchParams.get("id") : null;
    const fileId = byPath ?? queryId;
    return fileId && /^[a-zA-Z0-9_-]{10,}$/.test(fileId) ? fileId : null;
  } catch { return null; }
}

export async function fetchDriveBytes(fileId: string): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return { error: "Invalid Google Drive file identifier." };
  }
  const baseUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  const policy = { allowedHost: isTrustedDriveHost, maxBytes: 8 * 1024 * 1024, timeoutMs: 15000, maxRedirects: 4 };
  try {
    let result = await downloadRemoteBounded(baseUrl, policy);
    if (result.contentType.toLowerCase().includes("text/html")) {
      // Drive virus-scanner confirmation pages require a second request.
      // Read only bounded HTML; never follow arbitrary links in that page.
      const html = result.body.toString("utf8");
      const token = /confirm=([0-9A-Za-z_-]{1,128})/.exec(html)?.[1];
      if (!token) return { error: "Drive returned a page instead of an accessible PDF or Word file." };
      result = await downloadRemoteBounded(`${baseUrl}&confirm=${encodeURIComponent(token)}`, policy);
    }
    // Verify content from magic bytes. Do not feed HTML, unknown binary or
    // obsolete .doc OLE blobs to the PDF/DOCX decompression/parsing stack.
    const magic = result.body.subarray(0, 4).toString("latin1");
    if (magic === "%PDF") return { buffer: result.body, contentType: "application/pdf" };
    if (result.body.subarray(0, 2).toString("latin1") === "PK") {
      return { buffer: result.body,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    }
    return { error: "Only downloadable PDF and Word .docx resume files are supported." };
  } catch {
    return { error: "Could not download this Drive file safely. Check sharing permissions and file size (maximum 8 MB)." };
  }
}

export async function extractText(buffer: Buffer, contentType: string): Promise<ResumeFetchResult> {
  try {
    if (contentType === "application/pdf") {
      // unpdf wraps a current, actively-maintained build of Mozilla's own
      // pdf.js (not the old snapshot bundled inside the previously-used
      // pdf-parse package), specifically built for serverless/Node use with
      // no native/canvas dependency required for plain text extraction —
      // confirmed by testing it standalone before switching. It handles a
      // meaningfully wider range of PDFs than the old parser, including
      // several resume-builder templates (Canva, Zety, and similar) whose
      // custom embedded fonts previously came back as empty text.
      const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
      const trimmed = text.trim().slice(0, MAX_RESUME_CHARS);
      if (trimmed.length < MIN_USABLE_CHARS) {
        return {
          ok: false,
          error: "This PDF has no readable text (it's likely a scanned image rather than a real text document) — reading scanned/image-only resumes isn't supported yet.",
        };
      }
      return { ok: true, text: trimmed };
    }
    if (contentType.includes("wordprocessingml") || contentType === "application/msword") {
      const { value } = await mammoth.extractRawText({ buffer });
      const trimmed = value.trim().slice(0, MAX_RESUME_CHARS);
      if (trimmed.length < MIN_USABLE_CHARS) {
        return { ok: false, error: "This Word document appears to have no readable text." };
      }
      return { ok: true, text: trimmed };
    }
    return { ok: false, error: "This resume isn't a PDF or Word (.docx) file — only those two formats are supported right now." };
  } catch {
    // PDF/Word parsing libraries can echo filenames, embedded document text
    // or URLs in exception messages. Never return those details to callers.
    return { ok: false, error: "Couldn't read this resume file. Check that it is a valid PDF or Word document." };
  }
}

export async function fetchResumeText(resumeUrl: string | null): Promise<ResumeFetchResult> {
  if (!resumeUrl) {
    return { ok: false, error: "No resume URL saved for this candidate." };
  }

  if (resumeUrl.includes("docs.google.com/document") || resumeUrl.includes("docs.google.com/spreadsheets") || resumeUrl.includes("docs.google.com/presentation")) {
    return { ok: false, error: "This is a native Google Docs/Sheets/Slides link, not an uploaded PDF or Word file — those aren't supported yet." };
  }

  const fileId = extractDriveFileId(resumeUrl);
  if (!fileId) {
    return { ok: false, error: "Couldn't find a file ID in this Drive link — check it's a normal file share link." };
  }

  const fetched = await fetchDriveBytes(fileId);
  if ("error" in fetched) return { ok: false, error: fetched.error };

  return extractText(fetched.buffer, fetched.contentType);
}