import type { CategoryRow, TransactionRow } from "@/lib/db/schema";
import { normalize } from "@/lib/search/rank";

/**
 * Identidad de "misma categoría para el usuario", más allá del `id` —
 * households con datos de antes del fix de `apply-category-template.ts`
 * (que dedupeaba al reconciliar plantillas) pueden tener dos filas vivas
 * con el mismo `i18nKey` ("Supermercado" x2, distinto id cada una) que
 * acumulan uso por separado; sin esto las dos entraban al top-N. Una
 * plantilla identifica por `i18nKey` (estable); una categoría propia no
 * tiene `i18nKey`, así que cae al nombre normalizado.
 */
export function categoryIdentityKey(category: CategoryRow): string {
  return category.i18nKey ?? `name:${normalize(category.name)}`;
}

/**
 * La grilla completa del picker ("elegí una categoría") no pasaba por
 * `rankCategoriesByUsage` — ese fix solo dedupeaba el top-5 de más
 * usadas, así que un household con filas duplicadas de antes del fix de
 * `apply-category-template.ts` seguía viendo "Sueldo" u "Otros ingresos"
 * dos veces ahí. Se queda la fila con más uso real (mismo criterio que el
 * ranking); a igualdad de uso, la primera en el orden recibido. El orden
 * del array de entrada se preserva — esto filtra, no reordena.
 */
export function dedupeCategoriesByIdentity(categories: CategoryRow[], transactions: Pick<TransactionRow, "categoryId">[]): CategoryRow[] {
  const usageCounts = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    usageCounts.set(tx.categoryId, (usageCounts.get(tx.categoryId) ?? 0) + 1);
  }

  const survivorByIdentity = new Map<string, CategoryRow>();
  for (const category of categories) {
    const identity = categoryIdentityKey(category);
    const current = survivorByIdentity.get(identity);
    if (!current || (usageCounts.get(category.id) ?? 0) > (usageCounts.get(current.id) ?? 0)) {
      survivorByIdentity.set(identity, category);
    }
  }

  return categories.filter((category) => survivorByIdentity.get(categoryIdentityKey(category)) === category);
}

export interface CategoryUsage {
  categoryId: string;
  count: number;
  lastUsedAt: string;
}

const USAGE_WINDOW_DAYS = 90;

/**
 * Conteo de uso real por categoría — no existía ningún helper así en todo
 * el repo; lo más cercano (`money-flow.ts`, `analytics/categories/page.tsx`)
 * ordena por monto sumado, no por cantidad de movimientos. Ventana de 90
 * días: una categoría muy usada hace un año no le gana a una semanal. El
 * fallback a histórico completo lo decide `rankCategoriesByUsage`, no acá
 * — esta función solo cuenta lo que le pasan.
 */
export function countCategoryUsage(
  transactions: Pick<TransactionRow, "categoryId" | "kind" | "occurredAt">[],
  opts: { kind: "expense" | "income"; since?: string }
): CategoryUsage[] {
  const byCategory = new Map<string, CategoryUsage>();
  for (const tx of transactions) {
    if (tx.kind !== opts.kind || !tx.categoryId) continue;
    if (opts.since && tx.occurredAt < opts.since) continue;
    const existing = byCategory.get(tx.categoryId);
    if (!existing) {
      byCategory.set(tx.categoryId, { categoryId: tx.categoryId, count: 1, lastUsedAt: tx.occurredAt });
    } else {
      existing.count += 1;
      if (tx.occurredAt > existing.lastUsedAt) existing.lastUsedAt = tx.occurredAt;
    }
  }
  return [...byCategory.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.lastUsedAt !== b.lastUsedAt) return a.lastUsedAt < b.lastUsedAt ? 1 : -1;
    return a.categoryId < b.categoryId ? -1 : 1;
  });
}

/**
 * Categorías ordenadas por uso real, con relleno por `sortOrder` para
 * garantizar siempre `limit` burbujas — un household de tres días no tiene
 * historial, pero igual necesita mostrar algo. Excluye archivadas (ya
 * vienen filtradas por `categoriesRepo.list`) y transferencias (no llegan
 * acá: `kind` es `"expense" | "income"`).
 */
export function rankCategoriesByUsage(
  categories: CategoryRow[],
  usage: CategoryUsage[],
  opts: { kind: "expense" | "income"; limit: number }
): CategoryRow[] {
  const sameKind = categories.filter((c) => c.kind === opts.kind);
  const byId = new Map(sameKind.map((c) => [c.id, c]));
  const ranked: CategoryRow[] = [];
  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  for (const u of usage) {
    const category = byId.get(u.categoryId);
    if (!category || seenIds.has(category.id)) continue;
    const identity = categoryIdentityKey(category);
    if (seenIdentities.has(identity)) continue;
    ranked.push(category);
    seenIds.add(category.id);
    seenIdentities.add(identity);
    if (ranked.length >= opts.limit) return ranked;
  }

  const bySortOrder = [...sameKind].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const category of bySortOrder) {
    if (seenIds.has(category.id)) continue;
    const identity = categoryIdentityKey(category);
    if (seenIdentities.has(identity)) continue;
    ranked.push(category);
    seenIds.add(category.id);
    seenIdentities.add(identity);
    if (ranked.length >= opts.limit) break;
  }
  return ranked;
}

/**
 * Conveniencia: cuenta con la ventana de 90 días y, si da menos
 * categorías distintas que `limit`, recalcula sin ventana (histórico
 * completo) antes de rankear — así una categoría vieja pero muy usada no
 * queda afuera solo porque hace tiempo que no se usa, cuando no hay
 * suficiente actividad reciente para llenar las `limit` burbujas.
 */
export function rankRecentCategoriesByUsage(
  categories: CategoryRow[],
  transactions: Pick<TransactionRow, "categoryId" | "kind" | "occurredAt">[],
  opts: { kind: "expense" | "income"; limit: number; now: Date }
): CategoryRow[] {
  const since = new Date(opts.now.getTime() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentUsage = countCategoryUsage(transactions, { kind: opts.kind, since });
  const distinctRecent = new Set(recentUsage.map((u) => u.categoryId)).size;
  const usage = distinctRecent >= opts.limit ? recentUsage : countCategoryUsage(transactions, { kind: opts.kind });
  return rankCategoriesByUsage(categories, usage, { kind: opts.kind, limit: opts.limit });
}
