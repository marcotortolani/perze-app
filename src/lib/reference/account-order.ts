import type { AccountRow } from "@/lib/db/schema";

/**
 * Orden de cuentas para mostrar: agrupadas por moneda —la moneda base del
 * household primero, después alfabético, mismo criterio que ya usa
 * `AccountsListContent.tsx` (`/accounts`)— y dentro de cada grupo por
 * `sortOrder`, que es el orden que el usuario define con el drag&drop en
 * esa misma pantalla, con el nombre como desempate estable.
 *
 * `sortOrder` SOLO tiene significado DENTRO de un grupo de moneda:
 * `reorderAccounts` (`AccountsListContent.tsx`) lo reinicia en 0 en cada
 * grupo por separado, así que comparar `sortOrder` cruzando monedas
 * distintas no significaría nada — por eso la comparación de moneda va
 * primero y corta ahí.
 */
export function compareAccountsForDisplay(baseCurrency: string) {
  return (a: AccountRow, b: AccountRow): number => {
    if (a.currencyCode !== b.currencyCode) {
      if (a.currencyCode === baseCurrency) return -1;
      if (b.currencyCode === baseCurrency) return 1;
      return a.currencyCode.localeCompare(b.currencyCode);
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  };
}
