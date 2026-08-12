import { payeesRepo } from "@/lib/repos/payees-repo";

/**
 * A qué `payeeId` queda atado un movimiento a partir de lo que se tipeó en
 * "Comercio" (`DetailsSheet`). Usado por `saveDraftAsTransaction` y
 * `updateTransactionFromDraft` — antes ninguna de las dos llamaba a esto y
 * el campo se perdía en silencio (`payeeId: null` hardcodeado).
 *
 * `payeeId` ya resuelto (el usuario tocó un chip de sugerencia, no tipeó a
 * mano) gana siempre: es exacto, sin ambigüedad de nombre. Si no, se busca
 * por nombre/alias (`findByName`, case-insensitive) y, si no existe, se
 * crea uno nuevo — `defaultCategoryId` se siembra con la categoría de ESTE
 * movimiento, que es lo que hace que el próximo autocompletado (y su hint,
 * "Tienda Inglesa siempre cae en Supermercado") sirva de algo.
 *
 * Nunca bloquea el guardado: un fallo acá (Dexie lleno, lo que sea) deja
 * `payeeId: null` — el movimiento se guarda igual, solo sin comercio
 * asociado. Mismo invariante que el resto de la captura.
 */
export async function resolvePayeeId(householdId: string, payeeName: string, payeeId: string | null, defaultCategoryId: string | null): Promise<string | null> {
  if (payeeId) return payeeId;
  const name = payeeName.trim();
  if (name === "") return null;
  try {
    const existing = await payeesRepo.findByName(householdId, name);
    if (existing) return existing.id;
    const created = await payeesRepo.create({ householdId, name, defaultCategoryId, defaultAccountId: null, logoUrl: null, aliases: [] });
    return created.id;
  } catch {
    return null;
  }
}
