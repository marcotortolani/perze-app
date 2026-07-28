"use client";

import { useCallback } from "react";

/** Patrones exactos de `docs/02-design-system.md` § 5.3. */
const PATTERNS = {
  tap: 8,
  select: [12],
  success: [10, 40, 20],
  warning: [20, 60, 20],
  error: [40, 80, 40],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

/** `navigator.vibrate` con feature-detect — en iOS no existe: sin fallback sonoro, solo visual (ya lo da la animación). */
export function useHaptics() {
  return useCallback((pattern: HapticPattern = "tap") => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(PATTERNS[pattern] as number | number[]);
  }, []);
}
