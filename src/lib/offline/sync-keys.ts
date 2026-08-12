/**
 * Claves de `meta` compartidas entre `pull.ts` y el purge
 * (`purge-household-local.ts`) — extraídas a un módulo propio, sin
 * dependencias, para que ninguno de los dos tenga que importar al otro.
 * `pull.ts` necesita reconciliar un purge remoto (`purge-reconcile.ts` →
 * `wipeLocalHouseholdData`) y `wipeLocalHouseholdData` necesita borrar el
 * watermark (`pull.ts`) — sin este módulo intermedio, esas dos flechas
 * arman un ciclo de imports.
 */
export function watermarkKeyFor(householdId: string): string {
  return `pullWatermark:${householdId}`;
}
