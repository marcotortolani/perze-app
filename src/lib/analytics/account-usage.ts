import type { AccountRow, TransactionRow } from "@/lib/db/schema";

const USAGE_WINDOW_DAYS = 90;

export interface AccountUsage {
  accountId: string;
  count: number;
  lastCreatedAt: string;
}

/**
 * Conteo de uso real por cuenta — espejo de `countCategoryUsage`
 * (`category-usage.ts`), pero ordenado por `createdAt` del movimiento, no
 * por `occurredAt`. Para "la última cuenta usada" importa cuándo la
 * persona tocó el botón de guardar, no la fecha que le puso al gasto: una
 * carga tardía con fecha atrasada no debe hacer "saltar" el default a otra
 * cuenta (era exactamente el bug reportado en `/add`).
 */
export function countAccountUsage(
  transactions: Pick<TransactionRow, "accountId" | "createdAt">[],
  opts?: { since?: string }
): AccountUsage[] {
  const byAccount = new Map<string, AccountUsage>();
  for (const tx of transactions) {
    if (opts?.since && tx.createdAt < opts.since) continue;
    const existing = byAccount.get(tx.accountId);
    if (!existing) {
      byAccount.set(tx.accountId, { accountId: tx.accountId, count: 1, lastCreatedAt: tx.createdAt });
    } else {
      existing.count += 1;
      if (tx.createdAt > existing.lastCreatedAt) existing.lastCreatedAt = tx.createdAt;
    }
  }
  return [...byAccount.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.lastCreatedAt !== b.lastCreatedAt) return a.lastCreatedAt < b.lastCreatedAt ? 1 : -1;
    return a.accountId < b.accountId ? -1 : 1;
  });
}

/**
 * Cuentas activas ordenadas por uso real, con relleno por `sortOrder` para
 * garantizar siempre `limit` filas. Excluye archivadas siempre — una
 * cuenta que ya no se usa no debe aparecer como "más usada" ni como
 * default silencioso.
 */
export function rankAccountsByUsage(accounts: AccountRow[], usage: AccountUsage[], opts: { limit: number }): AccountRow[] {
  const active = accounts.filter((a) => a.archivedAt === null);
  const byId = new Map(active.map((a) => [a.id, a]));
  const ranked: AccountRow[] = [];
  const seen = new Set<string>();

  for (const u of usage) {
    const account = byId.get(u.accountId);
    if (!account || seen.has(account.id)) continue;
    ranked.push(account);
    seen.add(account.id);
    if (ranked.length >= opts.limit) return ranked;
  }

  const bySortOrder = [...active].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const account of bySortOrder) {
    if (seen.has(account.id)) continue;
    ranked.push(account);
    seen.add(account.id);
    if (ranked.length >= opts.limit) break;
  }
  return ranked;
}

/**
 * Conveniencia: cuenta con la ventana de 90 días y, si da menos cuentas
 * distintas que `limit`, recalcula sin ventana (histórico completo) antes
 * de rankear — mismo criterio que `rankRecentCategoriesByUsage`.
 */
export function rankRecentAccountsByUsage(
  accounts: AccountRow[],
  transactions: Pick<TransactionRow, "accountId" | "createdAt">[],
  opts: { limit: number; now: Date }
): AccountRow[] {
  const since = new Date(opts.now.getTime() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentUsage = countAccountUsage(transactions, { since });
  const distinctRecent = new Set(recentUsage.map((u) => u.accountId)).size;
  const usage = distinctRecent >= opts.limit ? recentUsage : countAccountUsage(transactions);
  return rankAccountsByUsage(accounts, usage, { limit: opts.limit });
}

/**
 * La cuenta "última usada" para el default de `/add` — el movimiento no
 * borrado con `createdAt` más reciente, cayendo a la primera cuenta activa
 * por `sortOrder` cuando no hay ninguna (household nuevo o esa cuenta ya
 * no existe). Mismo criterio de `createdAt` que el resto de este archivo:
 * la fecha que el usuario le puso al gasto (`occurredAt`) no cuenta acá.
 */
export function lastUsedAccount(accounts: AccountRow[], transactions: Pick<TransactionRow, "accountId" | "createdAt">[]): AccountRow | undefined {
  const active = accounts.filter((a) => a.archivedAt === null);
  let lastId: string | undefined;
  let lastCreatedAt = "";
  for (const tx of transactions) {
    if (tx.createdAt > lastCreatedAt) {
      lastCreatedAt = tx.createdAt;
      lastId = tx.accountId;
    }
  }
  const fromUsage = lastId ? active.find((a) => a.id === lastId) : undefined;
  if (fromUsage) return fromUsage;
  return [...active].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}
