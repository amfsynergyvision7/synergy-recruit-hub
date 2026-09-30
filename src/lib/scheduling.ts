// Shared, isomorphic helpers for interview scheduling links — imported by
// both the public /schedule/$token page (client) and scheduling.functions.ts
// (server), which is why this file carries no ".server" suffix and no
// secrets: unlike ai.server.ts/email.server.ts, nothing here needs to be kept
// out of the browser bundle.
//
// Slots are stored and passed around as plain "YYYY-MM-DDTHH:MM" strings —
// exactly what an <input type="datetime-local"> produces — on purpose: that
// format carries no timezone, so it's read back the same way a recruiter
// typed it (this team's local, IST, wall-clock time) with zero Date/timezone
// math anywhere in the round trip. interview_date/interview_time are
// themselves plain DATE/TIME columns with no timezone attached, so splitting
// the string on "T" is all that's needed to fill them in on confirm.
export const SLOT_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function splitSlot(slot: string): { date: string; time: string } {
  const [date, time] = slot.split("T");
  return { date, time };
}

export function formatSlotForDisplay(slot: string): string {
  const { date, time } = splitSlot(slot);
  const [y, m, d] = date.split("-").map(Number);
  // Formatted by hand instead of `new Date(slot)` — a bare "YYYY-MM-DDTHH:MM"
  // has no timezone, so the JS Date constructor would interpret it as the
  // *local* time of whichever machine runs this (the server's UTC clock on
  // Vercel, or a browser in some other timezone), silently shifting it by up
  // to 5.5 hours in exactly the place this file's whole point is to avoid
  // that. Using Date only for its weekday/month-name lookup tables (with a
  // local, no-timezone constructor) sidesteps that entirely.
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-IN", { weekday: "short" });
  const monthDay = dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const [h, min] = time.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${weekday}, ${monthDay} · ${hour12}:${String(min).padStart(2, "0")} ${ampm}`;
}