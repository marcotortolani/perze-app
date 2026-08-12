import { z } from "zod";
import type { HomeBlockId } from "../blocks/registry";

/**
 * Documento tal cual se persiste en `profiles.home_layout`. `left`/`right`/
 * `hidden` son `string[]`, NO `HomeBlockId[]`: un id que no existe en el
 * catálogo de HOY (de una versión futura, o de un bloque que se sacó) se
 * preserva igual — `resolveHomeLayout` es quien decide qué se renderiza,
 * nunca lo que se guarda.
 */
export interface StoredHomeLayout {
  v: 1;
  left: string[];
  right: string[];
  hidden: string[];
}

/** `null` = el perfil nunca personalizó el home — distinto de `{ left: [], ... }`. */
export type StoredHomeLayoutDoc = StoredHomeLayout | null;

export const storedHomeLayoutSchema = z.object({
  v: z.literal(1),
  left: z.array(z.string()),
  right: z.array(z.string()),
  hidden: z.array(z.string()),
});

/**
 * Parseo tolerante: cualquier cosa que no matchee la forma exacta (JSON
 * corrupto, `v` de una versión que este cliente no entiende, un doc
 * escrito por un cliente futuro con un campo distinto) devuelve `null` —
 * nunca tira. El caller trata `null` igual que "nunca personalizó": cae al
 * layout default y, a propósito, NO reescribe el documento del servidor
 * (`resolveHomeLayout` es puro; quien no reescribe es `use-home-layout.ts`).
 */
export function parseStoredHomeLayout(raw: unknown): StoredHomeLayoutDoc {
  if (raw === null || raw === undefined) return null;
  const result = storedHomeLayoutSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** El layout ya resuelto contra el catálogo canónico — lo que efectivamente se renderiza. */
export interface ResolvedHomeLayout {
  left: HomeBlockId[];
  right: HomeBlockId[];
  hidden: HomeBlockId[];
  /** `left ++ right` — el único orden que existe en mobile. */
  mobile: HomeBlockId[];
}
