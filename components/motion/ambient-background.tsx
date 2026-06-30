"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { usePageVisible } from "@/lib/use-page-visible";
import { Leaf } from "@/components/icons";

type DriftLeaf = {
  left: string;
  size: number;
  dur: number;
  delay: number;
  driftX: string;
  rot: string;
  opacity: number;
  tone: string;
};

/** Three to five leaves, sparse and slow, varied by depth. */
const LEAVES: DriftLeaf[] = [
  { left: "10%", size: 28, dur: 24, delay: 0, driftX: "26px", rot: "16deg", opacity: 0.1, tone: "text-moss" },
  { left: "34%", size: 18, dur: 31, delay: 6, driftX: "-18px", rot: "-12deg", opacity: 0.07, tone: "text-fern" },
  { left: "58%", size: 34, dur: 21, delay: 2, driftX: "34px", rot: "20deg", opacity: 0.08, tone: "text-moss" },
  { left: "80%", size: 16, dur: 34, delay: 9, driftX: "-22px", rot: "-10deg", opacity: 0.06, tone: "text-canopy" },
  { left: "92%", size: 24, dur: 27, delay: 13, driftX: "16px", rot: "13deg", opacity: 0.07, tone: "text-fern" },
];

export default function AmbientBackground() {
  const reduced = useReducedMotion();
  // Toggles `.tab-hidden` on <html> so CSS-driven ambient motion pauses.
  usePageVisible();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Sun through the canopy: a soft light that breathes very slowly */}
      <div
        className="canopy-light absolute left-1/2 top-[-20%] h-[78vh] w-[78vh] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--fern-ring) / 0.16), transparent 72%)",
          ...(reduced
            ? {}
            : { animation: "canopy-breathe 11s var(--ease-sway) infinite" }),
        }}
      />

      {/* Subtle organic blobs, very low opacity */}
      <div
        className="absolute -left-24 top-1/3 h-72 w-72 rounded-full opacity-[0.05] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--canopy), transparent)" }}
      />
      <div
        className="absolute -right-28 bottom-8 h-80 w-80 rounded-full opacity-[0.05] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--moss), transparent)" }}
      />

      {/* Drifting leaves, skipped entirely under reduced motion */}
      {!reduced &&
        LEAVES.map((l, i) => (
          <span
            key={i}
            className={`drift-leaf ${l.tone}`}
            style={
              {
                left: l.left,
                opacity: l.opacity,
                "--drift-dur": `${l.dur}s`,
                "--drift-delay": `${l.delay}s`,
                "--drift-x": l.driftX,
                "--drift-rot": l.rot,
              } as React.CSSProperties
            }
          >
            <Leaf size={l.size} strokeWidth={1.4} />
          </span>
        ))}
    </div>
  );
}
