import * as React from "react";

/**
 * Compact single-ring rosette mark, built from the AMF Synergy Vision logo's mandala motif.
 * Inherits color via `currentColor` — set text color with a className (e.g. text-sidebar-primary)
 * and it themes automatically with the app's light/dark palette.
 */
export function BrandMark({ className }: { className?: string }) {
  const id = React.useId();
  const petalId = `${id}-petal`;
  return (
    <svg
      viewBox="-50 -50 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <defs>
        <path id={petalId} d="M -7 -24 L 0 -42 L 7 -24" />
      </defs>
      {Array.from({ length: 12 }).map((_, i) => (
        <use key={i} href={`#${petalId}`} transform={`rotate(${i * 30})`} />
      ))}
      <circle r={24} strokeWidth={0.8} opacity={0.6} />
      <circle r={10} strokeWidth={1.4} />
      <circle r={46} strokeWidth={0.6} opacity={0.4} strokeDasharray="1 4" />
    </svg>
  );
}

/**
 * Larger three-ring mandala for decorative/watermark use — same motif as BrandMark, with more
 * detail so it holds up at large sizes. Meant to sit at low opacity behind other content.
 */
export function BrandMandala({ className }: { className?: string }) {
  const rings = [
    { r: 34, count: 8, len: 16 },
    { r: 60, count: 12, len: 18 },
    { r: 86, count: 16, len: 14 },
  ];
  return (
    <svg
      viewBox="-110 -110 220 220"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {rings.map((ring, ri) => (
        <g key={ri} opacity={0.85 - ri * 0.15}>
          <circle r={ring.r} strokeWidth={0.6} opacity={0.5} />
          {Array.from({ length: ring.count }).map((_, i) => {
            const angle = (360 / ring.count) * i;
            const inner = ring.r - ring.len * 0.5;
            const outer = ring.r + ring.len * 0.6;
            const half = ((360 / ring.count) * 0.28 * Math.PI) / 180;
            const lx = -Math.sin(half) * inner;
            const ly = -Math.cos(half) * inner;
            const rx = Math.sin(half) * inner;
            const ry = ly;
            return (
              <path
                key={i}
                d={`M ${lx} ${ly} L 0 ${-outer} L ${rx} ${ry}`}
                strokeWidth={1.1}
                transform={`rotate(${angle})`}
              />
            );
          })}
        </g>
      ))}
      <circle r={14} strokeWidth={1.6} />
      <circle r={102} strokeWidth={0.5} opacity={0.4} strokeDasharray="1 5" />
    </svg>
  );
}