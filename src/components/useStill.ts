"use client";

import { useSyncExternalStore } from "react";

// Hydration-safe "prefers reduced motion". motion's useReducedMotion reads the
// media query during the first client render, so the server HTML (motion on) and
// the client tree (motion off) disagree and React throws a hydration error.
// This returns false on the server and during hydration, then the real value.
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useStill(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
