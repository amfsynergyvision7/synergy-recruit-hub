// Server-only: fetches a candidate's resume straight from the Google Drive
// link stored in resume_url, parses it into plain text, and hands the text
// back for scoring. Nothing here is ever saved anywhere — the file is
// downloaded, read into memory, parsed, and discarded on every call, so this
// costs zero Supabase storage. It only works because the Drive link is
// genuinely "Anyone with the link" — a link restricted to specific people
// will fail to download here the same way it would in an incognito browser.
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

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
export function extractDriveFileId(url: string): string | null {
  // Covers the common Drive link shapes:
  //   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  //   https://drive.google.com/open?id=FILE_ID
  //   https://drive.google.com/uc?id=FILE_ID&export=download
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function fetchDriveBytes(fileId: string): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  let res = await fetch(baseUrl, { redirect: "follow" });
  let contentType = res.headers.get("content-type") ?? "";

  // Large files (or ones Drive "can't scan for viruses") return an HTML
  // interstitial page instead of the file, containing a confirm token that
  // has to be replayed as a query param to actually get the bytes.
  if (contentType.includes("text/html")) {
    const html = await res.text();
    const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
    if (!confirmMatch) {
      return { error: "Drive returned a page instead of the file — the link may not be set to \"Anyone with the link\"." };
    }
    res = await fetch(`${baseUrl}&confirm=${confirmMatch[1]}`, { redirect: "follow" });
    contentType = res.headers.get("content-type") ?? "";
  }

  if (!res.ok) {
    return { error: `Drive returned ${res.status} — the link may be broken, private, or the file may have been removed.` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Sniff the actual file type from magic bytes rather than trusting
  // content-type alone, since Drive doesn't always set it precisely.
  const isPdf = buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const isZipBased = buffer.subarray(0, 2).toString("latin1") === "PK"; // .docx is a zip archive

  if (isPdf) return { buffer, contentType: "application/pdf" };
  if (isZipBased) return { buffer, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  return { buffer, contentType };
}

export async function extractText(buffer: Buffer, contentType: string): Promise<ResumeFetchResult> {
  try {
    if (contentType === "application/pdf") {
      const data = await pdfParse(buffer);
      return { ok: true, text: data.text.trim().slice(0, MAX_RESUME_CHARS) };
    }
    if (contentType.includes("wordprocessingml") || contentType === "application/msword") {
      const { value } = await mammoth.extractRawText({ buffer });
      return { ok: true, text: value.trim().slice(0, MAX_RESUME_CHARS) };
    }
    return { ok: false, error: "This resume isn't a PDF or Word (.docx) file — only those two formats are supported right now." };
  } catch (err: any) {
    return { ok: false, error: `Couldn't read the resume file: ${err?.message ?? "unknown parsing error"}.` };
  }
}

export async function fetchResumeText(resumeUrl: string | null): Promise<ResumeFetchResult> {
  if (!resumeUrl) {
    return { ok: false, error: "No resume URL saved for this candidate." };
  }

  if (resumeUrl.includes("docs.google.com/document") || resumeUrl.includes("docs.google.com/spreadsheets") || resumeUrl.includes("docs.google.com/presentation")) {
    return { ok: false, error: "This is a native Google Docs/Sheets/Slides link, not an uploaded PDF or Word file — those aren't supported yet." };
  }

  if (!resumeUrl.includes("drive.google.com")) {
    return { ok: false, error: "Only Google Drive links are supported right now — this doesn't look like a Drive URL." };
  }

  const fileId = extractDriveFileId(resumeUrl);
  if (!fileId) {
    return { ok: false, error: "Couldn't find a file ID in this Drive link — check it's a normal file share link." };
  }

  const fetched = await fetchDriveBytes(fileId);
  if ("error" in fetched) return { ok: false, error: fetched.error };

  return extractText(fetched.buffer, fetched.contentType);
}