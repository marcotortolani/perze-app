import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Completa / Reducida / Mínima — `docs/02-design-system.md` § 5.4. */
export type MotionIntensity = "full" | "reduced" | "minimal";

interface MotionState {
  intensity: MotionIntensity;
  setIntensity: (intensity: MotionIntensity) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      intensity: "full",
      setIntensity: (intensity) => set({ intensity }),
    }),
    { name: "perze-motion-intensity" }
  )
);
