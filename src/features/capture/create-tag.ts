import type { TagRow } from "@/lib/db/schema";
import { normalize } from "@/lib/search/rank";

/** Antes de crear, ¿ya existe una etiqueta con ese nombre (sin distinguir acentos/mayúsculas)? Mismo criterio que `findExistingCategoryByName`, sin `kind` — los tags no lo tienen. */
export function findExistingTagByName(name: string, existing: TagRow[]): TagRow | undefined {
  const needle = normalize(name);
  return existing.find((tag) => normalize(tag.name) === needle);
}
