import * as React from "react";
import { useBranding } from "@/hooks/use-branding";
import { useColorTheme } from "@/hooks/use-color-theme";

/**
 * Shared geometry for the AMF Synergy Vision mandala mark: concentric rings of
 * teardrop "petals" around a core ring, all painted with one radial gradient.
 * The three gradient stops come from whichever color theme is active (see
 * src/lib/color-themes.ts) — the same three stops also drive BrandCircuit's
 * trace/via colors below, which is what makes switching themes in Settings
 * re-skin the watermark everywhere it's drawn, not just the rest of the UI's
 * flat colors. BrandMark is a simplified single-ring version for small UI
 * chrome (headers, nav bars) and is still used there; BrandMandala was the
 * full three-ring version used for hero sections/corner watermarks, now
 * superseded everywhere by BrandCircuit (see its own comment below). Opacity
 * is tuned to stay clearly visible rather than fade into a ghost at small
 * sizes or low layering.
 */

type RingSpec = { r: number; petals: number; len: number; w: number };

function petalPath(ring: RingSpec) {
  const r0 = ring.r - ring.len * 0.35;
  const r1 = ring.r + ring.len * 0.65;
  const spread = ((360 / ring.petals) * 0.32 * Math.PI) / 180;
  const mid = (r0 + r1) / 2;
  const x0 = 0;
  const y0 = -r0;
  const x1 = -Math.sin(spread) * mid;
  const y1 = -mid * Math.cos(spread);
  const x2 = Math.sin(spread) * mid;
  const y2 = y1;
  const x3 = 0;
  const y3 = -r1;
  return `M ${x0} ${y0} Q ${x1} ${y1} ${x3} ${y3} Q ${x2} ${y2} ${x0} ${y0} Z`;
}

function Mandala({
  className,
  style,
  viewBox,
  rings,
  coreR = 10,
  outerR,
}: {
  className?: string;
  style?: React.CSSProperties;
  viewBox: string;
  rings: RingSpec[];
  coreR?: number;
  outerR: number;
}) {
  const id = React.useId();
  const gradId = `${id}-grad`;
  const { theme } = useColorTheme();
  const gradient = theme.mandala;

  return (
    <svg viewBox={viewBox} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={gradient[0]} />
          <stop offset="55%" stopColor={gradient[1]} />
          <stop offset="100%" stopColor={gradient[2]} />
        </radialGradient>
      </defs>

      <circle r={coreR} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} />

      {rings.map((ring, ri) => (
        <g key={ri}>
          <circle
            r={ring.r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={0.75}
            strokeOpacity={0.6}
          />
          {Array.from({ length: ring.petals }).map((_, i) => (
            <g key={i} transform={`rotate(${(360 / ring.petals) * i})`}>
              <path
                d={petalPath(ring)}
                fill={`url(#${gradId})`}
                fillOpacity={Math.max(0.35, 0.65 - ri * 0.12)}
                stroke={`url(#${gradId})`}
                strokeWidth={ring.w * 0.4}
              />
            </g>
          ))}
        </g>
      ))}

      <circle
        r={outerR}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={0.5}
        strokeOpacity={0.4}
        strokeDasharray="1 5"
      />
    </svg>
  );
}

/** Compact single-ring emblem — for the sidebar header, login badge, and other small chrome. */
export function BrandMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Mandala
      className={className}
      style={style}
      viewBox="-62 -62 124 124"
      coreR={10}
      outerR={55}
      rings={[{ r: 34, petals: 8, len: 22, w: 2.4 }]}
    />
  );
}

/** Full three-ring mandala — for hero sections and corner watermarks. */
export function BrandMandala({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Mandala
      className={className}
      style={style}
      viewBox="-110 -110 220 220"
      coreR={10}
      outerR={100}
      rings={[
        { r: 30, petals: 8, len: 22, w: 2.4 },
        { r: 55, petals: 12, len: 26, w: 2 },
        { r: 82, petals: 16, len: 20, w: 1.6 },
      ]}
    />
  );
}

/**
 * Circuit-board-trace watermark — the CRM-wide replacement for BrandMandala
 * as the background/corner-watermark motif (sidebar, login panel, every
 * authenticated app page, and the public Careers pages). Still re-skins
 * itself from the active color theme (same three gradient stops as the
 * mandala), so it stays consistent with the brand even though the motif
 * itself is unrelated.
 *
 * v2 (upgraded from the original flat-dot/thin-line version after it read
 * as too faint in production): real PCB boards chamfer trace corners to 45°
 * instead of turning them at a sharp right angle, so the traces below do
 * too — it's a small detail but it's the difference between "line art" and
 * "circuit board." Vias are drawn as plated rings (an outer stroked circle
 * plus a filled core) rather than flat dots, there's a small IC footprint
 * with pin ticks and a pin-1 marker for texture, strokes are heavier and
 * more opaque, and the whole pattern is rendered twice — once blurred and
 * dimmer underneath, once crisp on top — for a soft neon glow instead of
 * flat linework. The radial fade mask is also wider/brighter than before so
 * more of the pattern actually survives before it fades out; it's still
 * biased toward the top-right of its own box (this art is always anchored
 * in a corner by its callers) so it reads as a corner watermark rather than
 * floor-to-ceiling wallpaper. BrandMandala's definition is kept below
 * (unused) in case the design is ever reverted.
 */
export function BrandCircuit({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const id = React.useId();
  const patternId = `${id}-circuit`;
  const fadeId = `${id}-fade`;
  const glowId = `${id}-glow`;
  const { theme } = useColorTheme();
  const [c0, c1, c2] = theme.mandala;

  return (
    <svg viewBox="0 0 400 400" className={className} style={style} aria-hidden="true">
      <defs>
        {/* 100px tile: three chamfered traces (each touching two tile edges
            so they connect seamlessly between repeats), five plated vias,
            and one IC footprint with pin ticks + a pin-1 dot. */}
        <pattern id={patternId} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M0 64 H18 L30 52 V20 L38 12 H58" fill="none" stroke={c1} strokeWidth="1.3" strokeOpacity={0.95} strokeLinecap="round" />
          <path d="M100 32 H78 L66 44 V72 L58 80 V100" fill="none" stroke={c0} strokeWidth="1.15" strokeOpacity={0.9} strokeLinecap="round" />
          <path d="M18 100 V86 L26 78 H46" fill="none" stroke={c2} strokeWidth="1.05" strokeOpacity={0.85} strokeLinecap="round" />

          <circle cx="30" cy="52" r="2.9" fill="none" stroke={c1} strokeWidth="1.1" />
          <circle cx="30" cy="52" r="1" fill={c1} />
          <circle cx="0" cy="64" r="2.6" fill="none" stroke={c1} strokeWidth="1" />
          <circle cx="0" cy="64" r="0.9" fill={c1} />
          <circle cx="66" cy="44" r="2.9" fill="none" stroke={c0} strokeWidth="1.1" />
          <circle cx="66" cy="44" r="1" fill={c0} />
          <circle cx="100" cy="32" r="2.6" fill="none" stroke={c0} strokeWidth="1" />
          <circle cx="100" cy="32" r="0.9" fill={c0} />
          <circle cx="26" cy="78" r="2.4" fill="none" stroke={c2} strokeWidth="1" />
          <circle cx="26" cy="78" r="0.85" fill={c2} />

          <rect x="42" y="38" width="13" height="18" rx="1.5" fill="none" stroke={c2} strokeWidth="1.1" strokeOpacity={0.9} />
          <path
            d="M42 42 H37 M42 48 H37 M42 54 H37 M55 42 H60 M55 48 H60 M55 54 H60"
            stroke={c2}
            strokeWidth="1.1"
            strokeOpacity={0.9}
            strokeLinecap="round"
          />
          <circle cx="45" cy="41" r="0.9" fill={c2} />
        </pattern>

        {/* Soft glow: the crisp pattern above is rendered a second time,
            blurred and slightly dimmer, underneath itself (see the two
            <rect>s below) rather than blurring individual trace paths
            inside the <pattern> — blurring the whole composited/masked
            rect avoids any risk of the blur bleeding across tile seams. */}
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>

        {/* Biased toward the top-right corner (75%/25%) rather than centered
            — this art is always placed in a corner (see its callers), so
            the densest part of the pattern should sit where the shape
            itself is anchored, fading smoothly outward from there rather
            than from the middle of its own bounding box. Wider/brighter
            stops than v1 so more of the pattern survives before fading
            out — more gradient stops than BrandMandala's own fade needs,
            since a tiled pattern shows banding with only two. */}
        <radialGradient id={fadeId} cx="75%" cy="25%" r="85%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor="white" stopOpacity="0.92" />
          <stop offset="65%" stopColor="white" stopOpacity="0.62" />
          <stop offset="85%" stopColor="white" stopOpacity="0.26" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${fadeId}-mask`}>
          <rect width="400" height="400" fill={`url(#${fadeId})`} />
        </mask>
      </defs>
      <rect width="400" height="400" fill={`url(#${patternId})`} mask={`url(#${fadeId}-mask)`} filter={`url(#${glowId})`} opacity={0.85} />
      <rect width="400" height="400" fill={`url(#${patternId})`} mask={`url(#${fadeId}-mask)`} />
    </svg>
  );
}

/**
 * Drop-in replacement for BrandMark in the small icon slots (sidebar header,
 * login badge): shows the company's uploaded logo (Settings → Branding,
 * admin-only) when one exists, and falls back to the default neon BrandMark
 * otherwise. The decorative BrandCircuit background art is unaffected either
 * way — uploading a logo adds it alongside the existing neon identity rather
 * than replacing it.
 */
export function BrandLogo({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { logoUrl } = useBranding();
  if (logoUrl) {
    // A raster/SVG logo the user uploaded — sized like the mark it replaces,
    // but without the neon drop-shadow (that glow is tuned for the mandala's
    // own thin cyan strokes and looks wrong over an arbitrary flat logo).
    return <img src={logoUrl} alt="Company logo" className={`${className ?? ""} object-contain`} />;
  }
  return <BrandMark className={className} style={style} />;
}