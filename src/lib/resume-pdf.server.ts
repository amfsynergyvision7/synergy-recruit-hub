// Server-only: draws the actual client-submission resume PDF from the
// structured data ai.server.ts's restructureResumeForClient() produces.
// Deliberately split from ai.server.ts the same way drive-import.server.ts
// is split from it for the bulk-import flow — this file owns PDF-drawing,
// ai.server.ts owns Gemini prompts/schemas.
//
// Uses pdfkit rather than pdfmake: pdfkit ships PDF's built-in standard-14
// fonts (Helvetica/Helvetica-Bold here) baked into the package as plain AFM
// data files it reads via fs at runtime — no external font file path to
// configure — so it needs nothing extra from the project's custom
// nodeFileTrace-based Vercel build (scripts/vercel-build.mjs), the same way
// mammoth/unpdf (already in production via resume-fetch.server.ts) need
// nothing extra. pdfmake's server-side API instead requires explicit font
// file paths to be wired up, which is a real risk under that same trace-based
// packaging and isn't worth it for a prototype-phase, free-tier app.
import PDFDocument from "pdfkit";
import type { ClientResumeStructured } from "./ai.server";

const PAGE_MARGIN = 50;
const ACCENT = "#7a3fe0"; // CRM's default (Neon) theme primary — a reasonable
// static brand color for a letterhead that's generated server-side with no
// access to the viewing user's selected color theme.
const INK = "#1a1830";
const MUTED = "#5c5580";
const RULE = "#dcd0f7";

export interface ClientResumePdfInput {
  fullName: string;
  email: string | null;
  mobile: string | null;
  location: string | null;
  positionApplied: string | null;
  logoBuffer: Buffer | null;
  resume: ClientResumeStructured;
}

// Best-effort fetch of the org's uploaded logo (app_settings.logo_url) for
// the PDF letterhead. Never throws — a broken/unreachable logo URL degrades
// to a text-only letterhead rather than failing the whole PDF generation.
export async function fetchLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function drawSectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT).text(text.toUpperCase(), { characterSpacing: 0.5 });
  const y = doc.y + 2;
  doc.moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).strokeColor(RULE).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(INK);
}

export async function buildClientResumePdf(input: ClientResumePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: { Title: `${input.fullName} — Resume`, Author: "AMF Synergy Vision" },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // --- Letterhead ---
  const letterheadTop = doc.y;
  if (input.logoBuffer) {
    try {
      doc.image(input.logoBuffer, PAGE_MARGIN, letterheadTop, { fit: [40, 40] });
    } catch {
      // Corrupt/unsupported image data — skip it rather than failing the PDF.
    }
  }
  const letterheadTextX = input.logoBuffer ? PAGE_MARGIN + 52 : PAGE_MARGIN;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(ACCENT)
    .text("AMF Synergy Vision", letterheadTextX, letterheadTop, { continued: false });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text("Recruitment & Staffing — Candidate Profile", letterheadTextX, doc.y);
  doc.moveDown(1.2);
  doc.fillColor(INK);

  // --- Candidate heading ---
  doc.font("Helvetica-Bold").fontSize(20).text(input.fullName);
  if (input.resume.headline) {
    doc.font("Helvetica").fontSize(12).fillColor(MUTED).text(input.resume.headline);
  }
  const contactLine = [input.email, input.mobile, input.location].filter(Boolean).join("   |   ");
  if (contactLine) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(contactLine);
  }
  if (input.positionApplied) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(`Target role: ${input.positionApplied}`);
  }
  doc.fillColor(INK);

  // --- Summary ---
  if (input.resume.summary) {
    drawSectionHeading(doc, "Professional Summary");
    doc.font("Helvetica").fontSize(10.5).text(input.resume.summary, { align: "left", lineGap: 2 });
  }

  // --- Skills ---
  if (input.resume.skills.length > 0) {
    drawSectionHeading(doc, "Core Skills");
    doc.font("Helvetica").fontSize(10.5).text(input.resume.skills.join("  •  "), { lineGap: 2 });
  }

  // --- Experience ---
  if (input.resume.experience.length > 0) {
    drawSectionHeading(doc, "Professional Experience");
    input.resume.experience.forEach((job, i) => {
      if (i > 0) doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10.5).text(job.company ? `${job.title} — ${job.company}` : job.title);
      if (job.duration) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(job.duration);
        doc.fillColor(INK);
      }
      job.bullets.forEach((bullet) => {
        doc.font("Helvetica").fontSize(10).text(`•  ${bullet}`, { indent: 10, lineGap: 1.5 });
      });
    });
  }

  // --- Education ---
  if (input.resume.education.length > 0) {
    drawSectionHeading(doc, "Education");
    input.resume.education.forEach((ed) => {
      const line = [ed.degree, ed.institution].filter(Boolean).join(" — ");
      doc.font("Helvetica").fontSize(10.5).text(ed.year ? `${line} (${ed.year})` : line, { lineGap: 1.5 });
    });
  }

  // --- Certifications ---
  if (input.resume.certifications.length > 0) {
    drawSectionHeading(doc, "Certifications");
    doc.font("Helvetica").fontSize(10.5).text(input.resume.certifications.join("  •  "), { lineGap: 2 });
  }

  // --- Footer ---
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
    `Submitted by AMF Synergy Vision on ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`,
    { align: "center" },
  );

  doc.end();
  return done;
}