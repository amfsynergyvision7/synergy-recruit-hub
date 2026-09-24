import * as React from "react";

/**
 * Shared geometry for the AMF Synergy Vision neon mandala mark: concentric rings of
 * teardrop "petals" around a core ring, all painted with one cyan → violet → magenta
 * radial gradient. BrandMark is a simplified single-ring version for small UI chrome
 * (headers, nav bars); BrandMandala is the full three-ring version meant for hero
 * sections and low-opacity corner watermarks.
 */

type RingSpec = { r: number; petals: number; len: number; w: number };

const NEON_GRADIENT: [string, string, string] = ["#2fe6ff", "#9b6bff", "#ff3fd0"];

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

  return (
    <svg viewBox={viewBox} className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor={NEON_GRADIENT[0]} />
          <stop offset="55%" stopColor={NEON_GRADIENT[1]} />
          <stop offset="100%" stopColor={NEON_GRADIENT[2]} />
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
            strokeOpacity={0.55}
          />
          {Array.from({ length: ring.petals }).map((_, i) => (
            <g key={i} transform={`rotate(${(360 / ring.petals) * i})`}>
              <path
                d={petalPath(ring)}
                fill={`url(#${gradId})`}
                fillOpacity={Math.max(0.2, 0.5 - ri * 0.1)}
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
        strokeOpacity={0.35}
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

/** Full three-ring mandala — for hero sections and low-opacity corner watermarks. */
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