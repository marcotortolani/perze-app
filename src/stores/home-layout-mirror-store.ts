import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist } from "@/lib/stores/persist-sanitize";
import { parseStoredHomeLayout } from "@/features/home/layout/types";
import type { StoredHomeLayoutDoc } from "@/features/home/layout/types";

/**
 * Espejo local del `home_layout` de `profiles` — no es la fuente de
 * verdad (esa es el servidor, por perfil, para que lo elegido en desktop
 * se vea en mobile), pero sirve para tres cosas que un `useQuery` solo no
 * resuelve: el primer pintado sin salto (antes de que la query resuelva),
 * `HomeSkeleton`/`(app)/loading.tsx` leyendo el orden sin red, y que el
 * modo demo (sin sesión real, donde el `update` a `profiles` falla por
 * RLS) siga funcionando en este dispositivo.
 */
interface HomeLayoutMirrorState {
  doc: StoredHomeLayoutDoc;
  setDoc: (doc: StoredHomeLayoutDoc) => void;
}

function sanitize(persisted: unknown): { doc: StoredHomeLayoutDoc } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { doc: parseStoredHomeLayout(p.doc) };
}

export const useHomeLayoutMirrorStore = create<HomeLayoutMirrorState>()(
  persist(
    (set) => ({
      doc: null,
      setDoc: (doc) => set({ doc }),
    }),
    { name: "perze-home-layout", version: 1, ...sanitizedPersist<HomeLayoutMirrorState, { doc: StoredHomeLayoutDoc }>(sanitize) }
  )
);
