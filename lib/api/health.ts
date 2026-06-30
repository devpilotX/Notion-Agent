"use client";

import * as React from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Polls the engine health endpoint so the status dot reflects reachability. */
export function useEngineOnline(intervalMs = 5000): boolean {
  const [online, setOnline] = React.useState<boolean>(Boolean(BASE));

  React.useEffect(() => {
    if (!BASE) {
      setOnline(false);
      return;
    }
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${BASE}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (active) setOnline(res.ok);
      } catch {
        if (active) setOnline(false);
      }
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return online;
}
