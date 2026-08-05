import { getDb } from "../db/client";
import { categoriesRepo } from "../repos/categories-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { budgetsRepo } from "../repos/budgets-repo";
import { recurringRulesRepo } from "../repos/recurring-rules-repo";
import { categorizationRulesRepo } from "../repos/categorization-rules-repo";
import { payeesRepo } from "../repos/payees-repo";

/**
 * Cuántas veces se usa una categoría, por tipo de referencia. Todo en cero
 * significa que borrarla no deja nada apuntando a la nada.
 */
export interface CategoryUsage {
  transactions: number;
  splits: number;
  budgets: number;
  recurringRules: number;
  categorizationRules: number;
  payees: number;
  /** Subcategorías vivas (activas o archivadas, no borradas) que cuelgan de ella. */
  children: number;
}

export type CategoryUsageKind = Exclude<keyof CategoryUsage, never>;

/** Snapshot de todas las tablas que referencian categorías, leído una sola vez. */
export interface CategoryUsageIndex {
  usageOf: (categoryId: string) => CategoryUsage;
  /** Ids de las subcategorías vivas directas. */
  childrenIdsOf: (categoryId: string) => string[];
}

export function totalUsage(usage: CategoryUsage): number {
  return usage.transactions + usage.splits + usage.budgets + usage.recurringRules + usage.categorizationRules + usage.payees + usage.children;
}

/** `true` si no queda nada apuntando a la categoría y por lo tanto se puede borrar. */
export function isDeletable(usage: CategoryUsage): boolean {
  return totalUsage(usage) === 0;
}

/** La categoría y todas sus descendientes, en orden de HOJA A RAÍZ. */
export function collectSubtree(index: CategoryUsageIndex, categoryId: string): string[] {
  const children = index.childrenIdsOf(categoryId).flatMap((childId) => collectSubtree(index, childId));
  // La raíz al final: borrar de la hoja hacia arriba deja la base
  // consistente en todo momento, sin un instante con hijas colgando de una
  // madre que ya no está.
  return [...children, categoryId];
}

/**
 * Uso ACUMULADO de una categoría y todo su subárbol, que es lo que decide si
 * se puede borrar: borrar arrastra a las subcategorías, así que lo que
 * bloquea no es tener hijas sino que alguna de ellas tenga algo asociado.
 *
 * `children` queda en 0 a propósito: las hijas se van en la misma operación,
 * así que dejarlas contando haría que ninguna madre fuera borrable nunca — que
 * es exactamente como se comportaba antes de permitir el borrado en cascada.
 */
export function subtreeUsage(index: CategoryUsageIndex, categoryId: string): CategoryUsage {
  const total: CategoryUsage = { transactions: 0, splits: 0, budgets: 0, recurringRules: 0, categorizationRules: 0, payees: 0, children: 0 };
  for (const id of collectSubtree(index, categoryId)) {
    const usage = index.usageOf(id);
    total.transactions += usage.transactions;
    total.splits += usage.splits;
    total.budgets += usage.budgets;
    total.recurringRules += usage.recurringRules;
    total.categorizationRules += usage.categorizationRules;
    total.payees += usage.payees;
  }
  return total;
}

/**
 * Construye el índice de uso de TODAS las categorías del household de una sola
 * pasada.
 *
 * Las seis tablas son las mismas que remapea `reassignAllReferences` en
 * `merge-duplicate-categories.ts`, que es la lista autoritativa del repo
 * (`goals` y `debts` no guardan `categoryId`). Si algún día aparece una
 * séptima, los dos módulos tienen que enterarse: el que fusiona, para no
 * dejar la referencia vieja; este, para no habilitar un borrado que la
 * rompa.
 *
 * El caso que obliga a mirar más allá de las transacciones es
 * `transaction_splits.categoryId`, que **no admite null**: un reparto cuya
 * categoría se borró no tiene forma de renderizarse ni de repararse desde la
 * interfaz. Los otros cuatro son nullables, así que romperlos no corrompe
 * nada, pero cambiaría en silencio un presupuesto o una regla que el usuario
 * no está mirando.
 *
 * También cuenta las subcategorías vivas: borrar una raíz que todavía tiene
 * hijas las dejaría colgando de un padre inexistente.
 *
 * **Las siete fuentes se leen acá adentro, en la misma pasada.** La lista de
 * categorías llegaba antes por parámetro, desde el estado de React de la
 * pantalla, y eso producía un índice mezclado: cinco tablas frescas de Dexie
 * más una lista que podía estar vieja. Se veía así — borrabas una categoría
 * archivada y la siguiente aparecía bloqueada por "3 subcategorías" que ya no
 * existían, hasta recargar la página. El motivo es que al borrar se
 * invalidan las dos queries a la vez, y la de uso se recalcula con el array
 * de categorías del render anterior, que todavía tiene adentro lo recién
 * borrado. Leyéndolo acá, el índice es consistente consigo mismo por
 * construcción y no depende de cuándo refresque React.
 */
export async function buildCategoryUsageIndex(householdId: string): Promise<CategoryUsageIndex> {
  const db = getDb();
  const [active, archived, transactions, budgets, recurringRules, categorizationRules, payees, splits] = await Promise.all([
    categoriesRepo.list(householdId),
    categoriesRepo.listArchived(householdId),
    transactionsRepo.list(householdId),
    budgetsRepo.list(householdId),
    recurringRulesRepo.list(householdId),
    categorizationRulesRepo.list(householdId),
    payeesRepo.list(householdId),
    db.transactionSplits.toArray(),
  ]);
  // Activas y archivadas: una hija archivada sigue siendo una hija, y borrar
  // a su madre la dejaría igual de huérfana.
  const categories = [...active, ...archived];

  const empty = (): CategoryUsage => ({ transactions: 0, splits: 0, budgets: 0, recurringRules: 0, categorizationRules: 0, payees: 0, children: 0 });
  const index = new Map<string, CategoryUsage>();
  const bump = (categoryId: string | null | undefined, key: keyof CategoryUsage) => {
    if (!categoryId) return;
    const current = index.get(categoryId) ?? empty();
    current[key] += 1;
    index.set(categoryId, current);
  };

  for (const tx of transactions) bump(tx.categoryId, "transactions");
  for (const split of splits) bump(split.categoryId, "splits");
  for (const budget of budgets) bump(budget.categoryId, "budgets");
  for (const rule of recurringRules) bump(rule.categoryId, "recurringRules");
  for (const rule of categorizationRules) bump(rule.actions.categoryId, "categorizationRules");
  for (const payee of payees) bump(payee.defaultCategoryId, "payees");
  const childrenIds = new Map<string, string[]>();
  for (const category of categories) {
    bump(category.parentId, "children");
    if (category.parentId) childrenIds.set(category.parentId, [...(childrenIds.get(category.parentId) ?? []), category.id]);
  }

  return {
    usageOf: (categoryId: string) => index.get(categoryId) ?? empty(),
    childrenIdsOf: (categoryId: string) => childrenIds.get(categoryId) ?? [],
  };
}
