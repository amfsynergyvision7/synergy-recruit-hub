/**
 * Small colored pill for status/stage-like fields across CrudModule tables
 * (candidates.stage, jobs.status, offers.offer_status, billing.payment_status, etc).
 * Reuses the app's existing --success / --warning / --info / --destructive tokens
 * via color-mix, matching the tinted-header pattern already used in styles.css,
 * so it looks correct in both light and dark mode with zero extra CSS.
 *
 * CrudModule's table uses `table-fixed`, so every column has a hard width and
 * normal text is allowed to wrap (`whitespace-normal break-words`) to stay inside
 * it. This pill intentionally never wraps a label onto two lines — that would
 * split the rounded shape awkwardly — so instead it caps itself at the width of
 * its own table cell and truncates with an ellipsis if a label is too long for
 * a narrow column, with the full label still available on hover via `title`.
 * That keeps it from ever bleeding into the next column, which is what was
 * happening before (e.g. "Submitted To Client" overlapping "Assigned Recruiter").
 */

export type PillTone = "ok" | "warn" | "info" | "bad" | "neutral";

const TONE_VAR: Record<PillTone, string> = {
  ok: "--success",
  warn: "--warning",
  info: "--info",
  bad: "--destructive",
  neutral: "--muted-foreground",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  const cssVar = TONE_VAR[tone];
  return (
    <span
      title={label}
      className="inline-flex max-w-full items-center overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap text-ellipsis align-middle"
      style={{
        background: `color-mix(in srgb, var(${cssVar}) 16%, var(--card))`,
        color: `var(${cssVar})`,
        border: `1px solid color-mix(in srgb, var(${cssVar}) 35%, var(--border))`,
      }}
    >
      {label}
    </span>
  );
}