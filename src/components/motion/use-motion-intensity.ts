"use client";

import { useReducedMotion } from "motion/react";
import { useMotionStore, type MotionIntensity } from "@/stores/motion-store";

/**
 * Ajuste propio de intensidad (Completa/Reducida/Mínima) combinado con
 * `prefers-reduced-motion` — `docs/02-design-system.md` § 5.4. El sistema
 * operativo nunca se pisa: si pide reducir movimiento y el usuario tiene
 * "Completa", el efectivo baja a "Reducida". El usuario sí puede pedir
 * menos que el sistema (Mínima).
 */
export function useMotionIntensity(): MotionIntensity {
  const stored = useMotionStore((s) => s.intensity);
  const prefersReduced = useReducedMotion();

  if (prefersReduced && stored === "full") return "reduced";
  return stored;
}
