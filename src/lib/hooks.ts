"use client";

import { useEffect, useState } from "react";

/**
 * True on compact-mobile viewports (< 768px). Extracted from page.tsx during the
 * component refactor so any component can read it.
 */
export function useCompactMobile() {
  const [isCompactMobile, setIsCompactMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompactMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompactMobile;
}
