import type { TagRow, TransactionTagRow } from "@/lib/db/schema";

/**
 * Mismo patrón que `category-usage.ts` (conteo por uso real, relleno hasta
 * `limit`), adaptado a tags: no tienen `kind` ni `sortOrder`, así que el
 * relleno cuando falta uso cae al orden de creación (`id`, UUID v7 —
 * ordenable por tiempo) en vez de un `sortOrder` que no existe acá.
 */
export function rankTagsByUsage(tags: TagRow[], transactionTags: TransactionTagRow[], limit: number): TagRow[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const counts = new Map<string, number>();
  for (const link of transactionTags) {
    counts.set(link.tagId, (counts.get(link.tagId) ?? 0) + 1);
  }

  const ranked: TagRow[] = [];
  const seen = new Set<string>();

  const byUsage = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tagId] of byUsage) {
    const tag = byId.get(tagId);
    if (!tag || seen.has(tag.id)) continue;
    ranked.push(tag);
    seen.add(tag.id);
    if (ranked.length >= limit) return ranked;
  }

  const rest = [...tags].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const tag of rest) {
    if (seen.has(tag.id)) continue;
    ranked.push(tag);
    seen.add(tag.id);
    if (ranked.length >= limit) break;
  }
  return ranked;
}
