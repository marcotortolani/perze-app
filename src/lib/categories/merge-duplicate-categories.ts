import { getDb } from "../db/client";
import { categoriesRepo } from "../repos/categories-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { budgetsRepo } from "../repos/budgets-repo";
import { recurringRulesRepo } from "../repos/recurring-rules-repo";
import { categorizationRulesRepo } from "../repos/categorization-rules-repo";
import { payeesRepo } from "../repos/payees-repo";
import { normalize } from "../search/rank";
import type { CategoryRow } from "../db/schema";

export interface MergeDuplicateCategoriesResult {
  /** Cuántas raíces duplicadas se fusionaron y archivaron. 0 = nada que hacer. */
  mergedCount: number;
}

/**
 * Red de seguridad contra categorías duplicadas — el caso reportado:
 * "Supermercado" x2 (una con movimientos y sin subcategorías, otra con 3
 * subcategorías y sin movimientos), mismo patrón en "Transporte". La causa
 * real ya se cerró en `detachFromTemplate`/`applyCategoryTemplate`
 * (`categories-repo.ts`: `i18nKey` ya no se anula al editar, así que un
 * cambio de plantilla posterior no vuelve a crear la fila), pero los
 * duplicados que ya existen en el household no se autocorrigen solos.
 *
 * Idempotente y barata de correr en cada entrada a la pantalla de
 * categorías: agrupa raíces ACTIVAS por (kind, nombre normalizado), y si
 * hay más de una en un grupo, fusiona todas menos la "titular" (más
 * movimientos; empate → la más vieja) — reasigna transacciones,
 * presupuestos, reglas recurrentes, reglas de auto-categorización, el
 * comercio por defecto y los splits, hijas incluidas (por nombre, o
 * reparentadas si la titular no tiene una hija con ese nombre), y archiva
 * la duplicada. Cuando no hay duplicados, es un puñado de scans en memoria
 * sin ninguna escritura.
 */
export async function mergeDuplicateCategories(householdId: string): Promise<MergeDuplicateCategoriesResult> {
  const categories = await categoriesRepo.list(householdId);
  const roots = categories.filter((c) => c.parentId === null);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    if (c.parentId) childrenByParent.set(c.parentId, [...(childrenByParent.get(c.parentId) ?? []), c]);
  }

  const groups = new Map<string, CategoryRow[]>();
  for (const root of roots) {
    const key = `${root.kind}:${normalize(root.name)}`;
    groups.set(key, [...(groups.get(key) ?? []), root]);
  }
  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);
  if (duplicateGroups.length === 0) return { mergedCount: 0 };

  const [transactions, budgets, recurringRules, categorizationRules, payees] = await Promise.all([
    transactionsRepo.list(householdId),
    budgetsRepo.list(householdId),
    recurringRulesRepo.list(householdId),
    categorizationRulesRepo.list(householdId),
    payeesRepo.list(householdId),
  ]);
  const movementCount = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.categoryId) movementCount.set(tx.categoryId, (movementCount.get(tx.categoryId) ?? 0) + 1);
  }

  const refs = { transactions, budgets, recurringRules, categorizationRules, payees };
  let mergedCount = 0;
  for (const group of duplicateGroups) {
    const sorted = [...group].sort((a, b) => {
      const byMovements = (movementCount.get(b.id) ?? 0) - (movementCount.get(a.id) ?? 0);
      if (byMovements !== 0) return byMovements;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
    const primary = sorted[0]!;
    const primaryChildren = childrenByParent.get(primary.id) ?? [];
    for (const duplicate of sorted.slice(1)) {
      await mergeRootIntoPrimary(duplicate, primary, childrenByParent.get(duplicate.id) ?? [], primaryChildren, refs);
      mergedCount++;
    }
  }
  return { mergedCount };
}

interface Refs {
  transactions: Awaited<ReturnType<typeof transactionsRepo.list>>;
  budgets: Awaited<ReturnType<typeof budgetsRepo.list>>;
  recurringRules: Awaited<ReturnType<typeof recurringRulesRepo.list>>;
  categorizationRules: Awaited<ReturnType<typeof categorizationRulesRepo.list>>;
  payees: Awaited<ReturnType<typeof payeesRepo.list>>;
}

async function mergeRootIntoPrimary(duplicate: CategoryRow, primary: CategoryRow, duplicateChildren: CategoryRow[], primaryChildren: CategoryRow[], refs: Refs): Promise<void> {
  for (const child of duplicateChildren) {
    const match = primaryChildren.find((c) => normalize(c.name) === normalize(child.name));
    if (match) {
      await reassignAllReferences(child.id, match.id, refs);
      await categoriesRepo.archive(child.id);
    } else {
      // Sin hija homónima en la titular: se reparenta tal cual, no hace
      // falta reasignar nada porque la fila (y sus referencias) sigue siendo
      // la misma, solo cambia de padre.
      await categoriesRepo.update(child.id, { parentId: primary.id });
    }
  }
  await reassignAllReferences(duplicate.id, primary.id, refs);
  await categoriesRepo.archive(duplicate.id);
}

/**
 * Reasigna toda referencia a `fromId` hacia `toId`, en las cinco tablas que
 * guardan una FK a `categories.id` (ver auditoría en el repo — `goals` y
 * `debts` no tienen). `transactionSplits` es la excepción: no tiene repo ni
 * ciclo de outbox propio todavía (nada escribe ahí hoy), así que se
 * actualiza directo sobre Dexie, sin outbox — no hay nada sincronizado que
 * romper.
 */
async function reassignAllReferences(fromId: string, toId: string, refs: Refs): Promise<void> {
  for (const tx of refs.transactions) {
    if (tx.categoryId === fromId) await transactionsRepo.update(tx.id, { categoryId: toId });
  }
  for (const budget of refs.budgets) {
    if (budget.categoryId === fromId) await budgetsRepo.update(budget.id, { categoryId: toId });
  }
  for (const rule of refs.recurringRules) {
    if (rule.categoryId === fromId) await recurringRulesRepo.update(rule.id, { categoryId: toId });
  }
  for (const rule of refs.categorizationRules) {
    if (rule.actions.categoryId === fromId) await categorizationRulesRepo.update(rule.id, { actions: { ...rule.actions, categoryId: toId } });
  }
  for (const payee of refs.payees) {
    if (payee.defaultCategoryId === fromId) await payeesRepo.update(payee.id, { defaultCategoryId: toId });
  }
  const db = getDb();
  const splits = await db.transactionSplits.toArray();
  const affected = splits.filter((s) => s.categoryId === fromId);
  for (const split of affected) {
    await db.transactionSplits.put({ ...split, categoryId: toId });
  }
}
