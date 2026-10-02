import * as React from "react";
import { useBranding } from "@/hooks/use-branding";
import { useColorTheme } from "@/hooks/use-color-theme";

/**
 * Shared geometry for the AMF Synergy Vision mandala mark: concentric rings of
 * teardrop "petals" around a core ring, all painted with one radial gradient.
 * The three gradient stops come from whichever color theme is active (see
 * src/lib/color-themes.ts) — the same three stops also drive BrandCircuit's
 * trace/via colors below (unused, kept for reference), which is what makes
 * switching themes in Settings re-skin the watermark everywhere it's drawn,
 * not just the rest of the UI's flat colors. BrandMark is a simplified
 * single-ring version for small UI chrome (headers, nav bars) and is still
 * used there; BrandMandala is the full three-ring version used for hero
 * sections/corner watermarks — the CRM-wide background motif again after a
 * detour through BrandCircuit and PageBackdrop (both below, unused, kept for
 * reference) read as too far from the brand's own identity. Opacity is
 * tuned to stay clearly visible rather than fade into a ghost at small
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

/**
 * Full three-ring mandala — for hero sections and corner watermarks. Live
 * CRM-wide background treatment for one round (after BrandCircuit and then
 * PageBackdrop were tried and set aside), now itself superseded by
 * BrandFacetBloom below. Kept defined (unused) in case it's wanted again.
 */
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
 * Facet Bloom — the current CRM-wide background treatment, replacing
 * BrandMandala above. Picked after comparing it side-by-side against two
 * sibling designs (a two-ring "Luminous Bloom" reusing BrandMandala's own
 * teardrop petals with a glow double-render, and an "Aurora Rings" design
 * that drops petals entirely for blurred color bands) across this CRM's
 * five color themes — including Navy & Gold, which swaps in a serif
 * heading font for a deliberately executive register. Facet Bloom read well
 * in both the brighter Neon Mandala theme and the more restrained executive
 * ones, which is what settled it.
 *
 * Two things carry over from the rest of this file: each ring is still
 * drawn with the active color theme's three-stop gradient (theme.mandala,
 * same as BrandMark/BrandMandala above), and the blurred-glow technique is
 * the same one BrandCircuit used — rendering shapes through an SVG
 * <feGaussianBlur> rather than a crisp outline — which is also the same
 * visual language as the app's own `.bg-primary` neon box-shadow glow in
 * styles.css. What's different from BrandMandala is the petal shape itself:
 * instead of a crisp quadratic teardrop, each "petal" here is a soft blob
 * built from two mirrored cubic Bezier curves, then blurred — closer to a
 * bloom of soft light than a flower's linework. Each ring gets its own
 * <filter>/blur radius (sized to that ring's own petal size) rather than
 * one shared filter, since a single blur radius looks right on one ring's
 * petal size and wrong on another's.
 */
export function BrandFacetBloom({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const id = React.useId();
  const gradId = `${id}-grad`;
  const { theme } = useColorTheme();
  const [c0, c1, c2] = theme.mandala;

  const rings = [
    { r: 30, n: 6, size: 20, color: c0, blur: 2.2 },
    { r: 62, n: 10, size: 22, color: c1, blur: 2.6 },
    { r: 92, n: 14, size: 16, color: c2, blur: 2 },
  ];

  function blobPetal(r: number, size: number) {
    return `M 0 ${-r + size} C ${size * 0.8} ${-r + size * 0.3}, ${size * 0.8} ${-r - size * 0.3}, 0 ${-r - size} C ${-size * 0.8} ${-r - size * 0.3}, ${-size * 0.8} ${-r + size * 0.3}, 0 ${-r + size} Z`;
  }

  return (
    <svg viewBox="-125 -125 250 250" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={c0} />
          <stop offset="55%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </radialGradient>
        {rings.map((ring, ri) => (
          <filter key={ri} id={`${id}-blur-${ri}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation={ring.blur} />
          </filter>
        ))}
      </defs>

      {rings.map((ring, ri) => (
        <g key={ri} filter={`url(#${id}-blur-${ri})`}>
          {Array.from({ length: ring.n }).map((_, i) => (
            <g key={i} transform={`rotate(${(360 / ring.n) * i})`}>
              <path d={blobPetal(ring.r, ring.size)} fill={ring.color} fillOpacity={0.6} />
            </g>
          ))}
        </g>
      ))}

      <circle r={12} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} />
      <circle r={110} fill="none" stroke={`url(#${gradId})`} strokeWidth={0.5} strokeOpacity={0.3} strokeDasharray="1 6" />
    </svg>
  );
}

/**
 * Circuit-board-trace watermark — briefly the CRM-wide background motif,
 * then superseded by PageBackdrop (below), and now both have been set aside
 * in favor of reverting to BrandMandala above. Kept defined (unused) in case
 * either design is wanted again.
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
 * floor-to-ceiling wallpaper.
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
 * Hairline Architecture — a CRM-wide background treatment tried after
 * BrandCircuit (and three earlier rounds of full-page concepts — aurora
 * blooms, dot-grids, hex fields) all read as some flavor of "bright tech
 * startup" rather than the restrained, enterprise-grade look wanted for a
 * staffing/recruitment firm. This one went the opposite direction: a
 * barely-visible single-tone diagonal hairline grid, one quiet warm-gold
 * glow tucked in a top-right corner, and a faint vignette for depth — no
 * neon, no glow-on-every-line, no dense texture. Set aside in favor of
 * reverting to BrandMandala (above); kept defined (unused) in case it's
 * wanted again.
 *
 * Two things make this component different from BrandMark/BrandMandala/
 * BrandCircuit above:
 *
 * 1. It does NOT re-skin itself from the active color theme (Settings →
 *    Branding). That's deliberate — the whole point of this treatment is to
 *    stay quiet and consistent no matter which bright accent color an org
 *    has picked for its buttons/links, rather than reintroducing a loud
 *    palette into the backdrop. If a future request wants the gold glow to
 *    instead track the org's theme (desaturated), that's a one-line change
 *    to swap the hardcoded color for a muted derivative of theme.mandala[0].
 *
 * 2. It's built from plain CSS gradients on a <div>, not an SVG pattern/
 *    viewBox. The earlier SVG components could assume a perfectly square
 *    container (their callers always sized them to equal height/width), so
 *    a single `viewBox="0 0 400 400"` always mapped 1:1 with no distortion.
 *    This one is meant to fill its entire parent via `inset-0` — the
 *    sidebar's narrow tall strip, the login panel, a wide dashboard page —
 *    and none of those are square. An SVG viewBox stretched with
 *    `preserveAspectRatio="none"` to fit a non-square box would skew the
 *    45° grid lines into parallelograms. CSS `repeating-linear-gradient`
 *    tiles in real pixels regardless of the element's aspect ratio, so the
 *    diagonals stay true 45° angles in a 260px-wide sidebar strip and a
 *    1400px-wide dashboard alike.
 */
export function PageBackdrop({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        backgroundImage: [
          // Warm-gold glow, anchored top-right (same corner convention the
          // earlier BrandMandala/BrandCircuit callers used).
          "radial-gradient(ellipse 640px 480px at 88% 8%, rgba(201,160,82,0.16), transparent 70%)",
          // Vignette: a very soft darkening toward the edges for quiet depth.
          "radial-gradient(ellipse 140% 110% at 50% 38%, transparent 55%, rgba(0,0,0,0.3) 100%)",
          // Single-tone hairline grid — two diagonal hairline sets forming
          // a diamond lattice, one slightly dimmer than the other so it
          // doesn't read as a flat X pattern.
          "repeating-linear-gradient(45deg, rgba(170,178,197,0.14) 0px, rgba(170,178,197,0.14) 1px, transparent 1px, transparent 64px)",
          "repeating-linear-gradient(-45deg, rgba(170,178,197,0.11) 0px, rgba(170,178,197,0.11) 1px, transparent 1px, transparent 64px)",
        ].join(", "),
        ...style,
      }}
    />
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