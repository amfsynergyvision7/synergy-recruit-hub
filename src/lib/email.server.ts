// Server-only SMTP email sending, via a real mailbox you own rather than a
// dedicated transactional-email product — no separate account to sign up
// for, no DNS domain-verification step. Defaults to Gmail's SMTP relay
// (smtp.gmail.com), but every setting is a plain environment variable, so
// switching providers later (a paid Zoho Workspace plan, Outlook, your own
// mail server) never needs another code change — only different env var
// VALUES on Vercel. (This one file has now been Resend, then Zoho, then
// Gmail, across the same project — that churn is exactly why the provider
// name doesn't appear anywhere in the code this time.)
//
// SMTP_USER / SMTP_PASSWORD must be set as server environment variables
// (Vercel project settings, same place SUPABASE_URL / GEMINI_API_KEY
// already live); they're never read or referenced from client-side code, so
// they can't end up in the browser bundle.
//
// Three things only you can do, since they require your own account:
//   1. Turn on 2-Step Verification on the Gmail account you'll send from
//      (myaccount.google.com/security) — Google requires this before it
//      will let you create an App Password at all; the account's normal
//      login password will not work here.
//   2. Under the same Security settings, search "App Passwords" → create
//      one (any label, e.g. "AMF CRM") → copy the 16-character password it
//      shows (spaces don't matter, paste it with or without them).
//   3. Set SMTP_USER (the full Gmail address) and SMTP_PASSWORD (the App
//      Password from step 2) as environment variables on Vercel and
//      redeploy. Optional: SMTP_FROM_NAME controls the display name
//      recipients see (defaults to "AMF Synergy Vision" below).
//
// Using a DIFFERENT provider later: set SMTP_HOST (default
// "smtp.gmail.com"), SMTP_PORT (default 465) and, if that provider's port
// isn't a plain SSL port, SMTP_SECURE=false — everything else is unchanged.
// Free personal Gmail caps at 500 emails/day (2,000/day on Workspace) —
// comfortably above what a recruiting CRM like this sends.
import nodemailer from "nodemailer";

export interface SendEmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

// Cached across invocations on a warm serverless instance, same lazy-
// singleton pattern as supabaseAdmin in client.server.ts — avoids
// re-authenticating a fresh SMTP connection on every single send within the
// same warm container.
let _transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
let _transporterKey: string | undefined;

function getTransporter(user: string, pass: string) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  // Keyed on the settings that actually affect the connection, so changing
  // an env var (e.g. testing a different account) without redeploying the
  // whole function still picks up fresh config instead of reusing a stale
  // cached transporter from before the change.
  const key = `${host}:${port}:${secure}:${user}`;
  if (_transporter && _transporterKey === key) return _transporter;
  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  _transporterKey = key;
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    const missing = [!user && "SMTP_USER", !pass && "SMTP_PASSWORD"].filter(Boolean).join(", ");
    return { success: false, error: `${missing} not configured. Add it as an environment variable and redeploy.` };
  }
  const fromName = process.env.SMTP_FROM_NAME || "AMF Synergy Vision";

  try {
    const info = await getTransporter(user, pass).sendMail({
      from: `"${fromName}" <${user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { success: true, providerId: info.messageId };
  } catch (err: any) {
    // A bad/expired App Password, 2-Step Verification not actually turned
    // on, or the account's daily sending cap all surface here as a thrown
    // error from nodemailer rather than an HTTP status — message text is
    // whatever the SMTP server replied with (e.g. Gmail's own "535-5.7.8
    // Username and Password not accepted"), which is usually specific
    // enough to act on directly.
    return { success: false, error: err?.message ?? "SMTP send failed for an unknown reason." };
  }
}

// Plain body text -> minimal HTML email. Recruiters type plain text in the
// compose box; this just preserves line breaks and escapes anything that
// would otherwise be read as markup.
export function textToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escaped}</div>`;
}