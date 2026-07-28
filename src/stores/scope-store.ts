import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Personal / Compartido / Todo — `docs/02-design-system.md` § 8, `<ScopeSwitcher>`. */
export type Scope = "personal" | "household" | "all";

interface ScopeState {
  scope: Scope;
  setScope: (scope: Scope) => void;
}

export const useScopeStore = create<ScopeState>()(
  persist(
    (set) => ({
      scope: "household",
      setScope: (scope) => set({ scope }),
    }),
    { name: "perze-scope" }
  )
);
