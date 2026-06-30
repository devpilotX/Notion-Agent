"use client";

import { useEffect, useState } from "react";

/**
 * Returns true while the document/tab is visible.
 * Also toggles a `.tab-hidden` class on <html> so CSS animations can pause.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onChange = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      document.documentElement.classList.toggle("tab-hidden", !isVisible);
    };
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
