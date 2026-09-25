/**
 * Small colored pill for status/stage-like fields across CrudModule tables
 * (candidates.stage, jobs.status, offers.offer_status, billing.payment_status, etc).
 * Reuses the app's existing --success / --warning / --info / --destructive tokens
 * via color-mix, matching the tinted-header pattern already used in styles.css,
 * so it looks correct in both light and dark mode with zero extra CSS.
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
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap"
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