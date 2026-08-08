import { create } from "zustand";
import { persist } from "zustand/middleware";
import { oneOf, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/** Personal / Compartido / Todo — `docs/02-design-system.md` § 8, `<ScopeSwitcher>`. */
export type Scope = "personal" | "household" | "all";

interface ScopeState {
  scope: Scope;
  setScope: (scope: Scope) => void;
}

const SCOPES = ["personal", "household", "all"] as const;

function sanitize(persisted: unknown): { scope: Scope } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { scope: oneOf(SCOPES, "household")(p.scope) };
}

export const useScopeStore = create<ScopeState>()(
  persist(
    (set) => ({
      scope: "household",
      setScope: (scope) => set({ scope }),
    }),
    { name: "perze-scope", version: 1, ...sanitizedPersist<ScopeState, { scope: Scope }>(sanitize) }
  )
);
