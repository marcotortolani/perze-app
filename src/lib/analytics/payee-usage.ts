import type { PayeeRow, TransactionRow } from "@/lib/db/schema";

/**
 * Mismo patrón que `tag-usage.ts` (conteo por uso real, relleno hasta
 * `limit`) — a diferencia de tags, el uso de un payee vive directo en
 * `transactions.payeeId`, sin tabla puente. El relleno cuando falta uso
 * cae al orden de creación (`id`, UUID v7 — ordenable por tiempo), igual
 * que tags.
 */
export function rankPayeesByUsage(payees: PayeeRow[], transactions: Pick<TransactionRow, "payeeId">[], limit: number): PayeeRow[] {
  const byId = new Map(payees.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.payeeId === null) continue;
    counts.set(tx.payeeId, (counts.get(tx.payeeId) ?? 0) + 1);
  }

  const ranked: PayeeRow[] = [];
  const seen = new Set<string>();

  const byUsage = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [payeeId] of byUsage) {
    const payee = byId.get(payeeId);
    if (!payee || seen.has(payee.id)) continue;
    ranked.push(payee);
    seen.add(payee.id);
    if (ranked.length >= limit) return ranked;
  }

  const rest = [...payees].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const payee of rest) {
    if (seen.has(payee.id)) continue;
    ranked.push(payee);
    seen.add(payee.id);
    if (ranked.length >= limit) break;
  }
  return ranked;
}
