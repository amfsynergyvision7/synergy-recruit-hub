import * as React from "react";
import { useBranding } from "@/hooks/use-branding";
import { useColorTheme } from "@/hooks/use-color-theme";

/**
 * Shared geometry for the AMF Synergy Vision mandala mark: concentric rings of
 * teardrop "petals" around a core ring, all painted with one radial gradient.
 * The three gradient stops come from whichever color theme is active (see
 * src/lib/color-themes.ts) — this is the piece that makes switching themes
 * in Settings re-skin the mandala everywhere it's drawn (sidebar, login
 * panel, the corner watermark on every app page), not just the rest of the
 * UI's flat colors. BrandMark is a simplified single-ring version for small
 * UI chrome (headers, nav bars); BrandMandala is the full three-ring version
 * meant for hero sections and corner watermarks. Opacity is tuned to stay
 * clearly visible rather than fade into a ghost at small sizes or low
 * layering.
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
 * Circuit-board-trace watermark — an alternative to BrandMandala for the
 * public Careers pages specifically. Still re-skins itself from the active
 * color theme (same three gradient stops as the mandala), so it stays
 * consistent with the brand even though the motif itself is unrelated: a
 * small repeating tile of right-angled "traces" with dot "vias" at the
 * bends, filled into a square and faded out radially at the edges so it
 * reads as a soft corner watermark rather than a hard-edged tiled
 * rectangle — the same visual role the mandala played, just a calmer,
 * more technical motif for a page candidates (not just recruiters) see.
 * BrandMandala itself is untouched and still used everywhere else (sidebar,
 * login) — this only replaces its use as careers-page background art.
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
  const { theme } = useColorTheme();
  const [c0, c1, c2] = theme.mandala;

  return (
    <svg viewBox="0 0 400 400" className={className} style={style} aria-hidden="true">
      <defs>
        {/* 72px (not 50px) tile: sparser traces read as architecture rather
            than wallpaper at the sizes this renders at. */}
        <pattern id={patternId} width="72" height="72" patternUnits="userSpaceOnUse">
          <path d="M0 44 H26 V0" fill="none" stroke={c1} strokeWidth="0.75" strokeOpacity={0.8} />
          <path d="M50 72 V52 H72" fill="none" stroke={c0} strokeWidth="0.75" strokeOpacity={0.8} />
          <circle cx="26" cy="0" r="1.6" fill={c1} />
          <circle cx="0" cy="44" r="1.6" fill={c0} />
          <circle cx="50" cy="72" r="1.6" fill={c1} />
          <circle cx="72" cy="52" r="1.6" fill={c2} />
          <rect x="34" y="24" width="8" height="8" rx="1" fill="none" stroke={c2} strokeWidth="0.75" strokeOpacity={0.8} />
        </pattern>
        {/* Biased toward the top-right corner (75%/25%) rather than centered
            — this art is always placed in a top-right corner (see its
            callers), so the densest part of the pattern should sit where
            the shape itself is anchored, fading smoothly outward from
            there rather than from the middle of its own bounding box. More
            gradient stops than BrandMandala's own fade needs, since a tiled
            pattern shows banding with only two. */}
        <radialGradient id={fadeId} cx="75%" cy="25%" r="75%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="30%" stopColor="white" stopOpacity="0.85" />
          <stop offset="55%" stopColor="white" stopOpacity="0.5" />
          <stop offset="80%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${fadeId}-mask`}>
          <rect width="400" height="400" fill={`url(#${fadeId})`} />
        </mask>
      </defs>
      <rect width="400" height="400" fill={`url(#${patternId})`} mask={`url(#${fadeId}-mask)`} />
    </svg>
  );
}

/**
 * Drop-in replacement for BrandMark in the small icon slots (sidebar header,
 * login badge): shows the company's uploaded logo (Settings → Branding,
 * admin-only) when one exists, and falls back to the default neon BrandMark
 * otherwise. The decorative BrandMandala background art is unaffected either
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