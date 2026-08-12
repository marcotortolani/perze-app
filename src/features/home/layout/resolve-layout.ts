import type { HomeBlockId } from "../blocks/registry";
import { parseStoredHomeLayout, type ResolvedHomeLayout } from "./types";

export interface HomeLayoutCatalog {
  catalog: HomeBlockId[];
  defaultLeft: HomeBlockId[];
  defaultRight: HomeBlockId[];
}

/**
 * Convierte el documento crudo (lo que vino de `profiles.home_layout` o del
 * espejo local) en el layout que se renderiza. Puro: mismo input, mismo
 * output, sin leer el catálogo desde `registry.ts` — lo recibe por
 * parámetro para poder testearse sin importar los 7 componentes de bloque.
 *
 * Reglas, en orden:
 * 1. `raw` inválido o `v` desconocida → se trata como si no hubiera doc
 *    (layout default). El caller (`use-home-layout.ts`) es quien decide no
 *    reescribir el servidor en este caso — acá no se toca nada, es puro.
 * 2. Un id que no está en `catalog` (de una versión futura, o de un bloque
 *    que se sacó) se descarta del resultado — pero NO de este doc: quien
 *    vuelve a serializar (`layout-actions.ts`) es responsable de
 *    preservarlo en el documento guardado.
 * 3. Un bloque del catálogo ausente del doc se inserta junto a su
 *    predecesor default más cercano que ya esté presente en la columna
 *    resuelta — nunca al final. Si doc es `null`, todos están "ausentes" y
 *    el resultado es exactamente `{ left: defaultLeft, right: defaultRight,
 *    hidden: [] }`.
 * 4/5. Duplicados entre `left`/`right`/`hidden` (un doc corrupto a mano):
 *    `hidden` gana siempre — es la señal más intencional, alguien lo
 *    ocultó a propósito — y entre `left`/`right` gana `left`.
 */
export function resolveHomeLayout(raw: unknown, { catalog, defaultLeft, defaultRight }: HomeLayoutCatalog): ResolvedHomeLayout {
  const doc = parseStoredHomeLayout(raw);
  const catalogSet = new Set(catalog);
  const defaultColumnOf = new Map<HomeBlockId, "left" | "right">();
  for (const id of defaultLeft) defaultColumnOf.set(id, "left");
  for (const id of defaultRight) defaultColumnOf.set(id, "right");

  const seen = new Set<HomeBlockId>();
  const hidden: HomeBlockId[] = [];
  const left: HomeBlockId[] = [];
  const right: HomeBlockId[] = [];

  const collectInto = (ids: string[], into: HomeBlockId[]) => {
    for (const rawId of ids) {
      if (!catalogSet.has(rawId as HomeBlockId)) continue;
      const id = rawId as HomeBlockId;
      if (seen.has(id)) continue;
      seen.add(id);
      into.push(id);
    }
  };

  if (doc) {
    collectInto(doc.hidden, hidden);
    collectInto(doc.left, left);
    collectInto(doc.right, right);
  }

  // Bloques del catálogo que el doc no menciona — incluye TODOS cuando
  // `doc` es `null`. Recorrer el catálogo en orden default (izquierda
  // completa, después derecha) hace la inserción determinística.
  for (const id of [...defaultLeft, ...defaultRight]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const isRight = defaultColumnOf.get(id) === "right";
    const column = isRight ? right : left;
    const defaultColumnIds = isRight ? defaultRight : defaultLeft;
    const myDefaultIndex = defaultColumnIds.indexOf(id);
    let insertAt = 0;
    for (let i = myDefaultIndex - 1; i >= 0; i--) {
      const predecessorIndex = column.indexOf(defaultColumnIds[i]!);
      if (predecessorIndex !== -1) {
        insertAt = predecessorIndex + 1;
        break;
      }
    }
    column.splice(insertAt, 0, id);
  }

  return { left, right, hidden, mobile: [...left, ...right] };
}
