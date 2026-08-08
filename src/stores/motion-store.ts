import { create } from "zustand";
import { persist } from "zustand/middleware";
import { oneOf, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/** Completa / Reducida / Mínima — `docs/02-design-system.md` § 5.4. */
export type MotionIntensity = "full" | "reduced" | "minimal";

interface MotionState {
  intensity: MotionIntensity;
  setIntensity: (intensity: MotionIntensity) => void;
}

const MOTION_INTENSITIES = ["full", "reduced", "minimal"] as const;

function sanitize(persisted: unknown): { intensity: MotionIntensity } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { intensity: oneOf(MOTION_INTENSITIES, "full")(p.intensity) };
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      intensity: "full",
      setIntensity: (intensity) => set({ intensity }),
    }),
    { name: "perze-motion-intensity", version: 1, ...sanitizedPersist<MotionState, { intensity: MotionIntensity }>(sanitize) }
  )
);
