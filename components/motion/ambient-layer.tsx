"use client";

import dynamic from "next/dynamic";

// Lazy-loaded, client-only: keeps ambient motion off the critical path / SSR.
const AmbientBackground = dynamic(() => import("./ambient-background"), {
  ssr: false,
});

export function AmbientLayer() {
  return <AmbientBackground />;
}
