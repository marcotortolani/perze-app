import type { HomeBlockId } from "../blocks/registry";
import { resolveHomeLayout, type HomeLayoutCatalog } from "./resolve-layout";
import type { ResolvedHomeLayout, StoredHomeLayout, StoredHomeLayoutDoc } from "./types";

/** Ids del doc crudo que no pertenecen al catálogo — se transportan tal cual, nunca se interpretan. */
function unknownIdsByColumn(doc: StoredHomeLayoutDoc, catalog: HomeBlockId[]) {
  const catalogSet = new Set(catalog);
  const isUnknown = (id: string) => !catalogSet.has(id as HomeBlockId);
  if (!doc) return { left: [] as string[], right: [] as string[], hidden: [] as string[] };
  return { left: doc.left.filter(isUnknown), right: doc.right.filter(isUnknown), hidden: doc.hidden.filter(isUnknown) };
}

function serialize(resolved: ResolvedHomeLayout, unknown: { left: string[]; right: string[]; hidden: string[] }): StoredHomeLayout {
  return {
    v: 1,
    left: [...resolved.left, ...unknown.left],
    right: [...resolved.right, ...unknown.right],
    hidden: [...resolved.hidden, ...unknown.hidden],
  };
}

/** Mueve `id` a `toColumn`, en la posición `toIndex` (clampeada al tamaño de la columna destino). */
export function moveBlock(
  doc: StoredHomeLayoutDoc,
  params: { id: HomeBlockId; toColumn: "left" | "right"; toIndex: number },
  catalog: HomeLayoutCatalog
): StoredHomeLayout {
  const resolved = resolveHomeLayout(doc, catalog);
  const unknown = unknownIdsByColumn(doc, catalog.catalog);

  const left = resolved.left.filter((x) => x !== params.id);
  const right = resolved.right.filter((x) => x !== params.id);
  const hidden = resolved.hidden.filter((x) => x !== params.id);
  const target = params.toColumn === "left" ? left : right;
  target.splice(Math.max(0, Math.min(params.toIndex, target.length)), 0, params.id);

  return serialize({ left, right, hidden, mobile: [...left, ...right] }, unknown);
}

/** Saca `id` de su columna y lo manda a la bandeja de ocultos. */
export function hideBlock(doc: StoredHomeLayoutDoc, id: HomeBlockId, catalog: HomeLayoutCatalog): StoredHomeLayout {
  const resolved = resolveHomeLayout(doc, catalog);
  const unknown = unknownIdsByColumn(doc, catalog.catalog);

  const left = resolved.left.filter((x) => x !== id);
  const right = resolved.right.filter((x) => x !== id);
  const hidden = [...resolved.hidden.filter((x) => x !== id), id];

  return serialize({ left, right, hidden, mobile: [...left, ...right] }, unknown);
}

/**
 * Saca `id` de la bandeja de ocultos y lo reinserta en su columna default,
 * junto a su vecino — el mismo algoritmo que usa `resolveHomeLayout` para
 * un bloque del catálogo ausente del doc. Se logra sacando el id del doc
 * por completo y dejando que `resolveHomeLayout` lo trate como "ausente".
 */
export function showBlock(doc: StoredHomeLayoutDoc, id: HomeBlockId, catalog: HomeLayoutCatalog): StoredHomeLayout {
  const withoutId: StoredHomeLayoutDoc = doc
    ? { v: 1, left: doc.left.filter((x) => x !== id), right: doc.right.filter((x) => x !== id), hidden: doc.hidden.filter((x) => x !== id) }
    : null;
  const resolved = resolveHomeLayout(withoutId, catalog);
  const unknown = unknownIdsByColumn(doc, catalog.catalog);
  return serialize(resolved, unknown);
}

/** Vuelve al layout default — `null`, no una copia congelada de los defaults de hoy. */
export function resetLayout(): null {
  return null;
}
