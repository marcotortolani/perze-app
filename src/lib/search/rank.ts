/**
 * Ranking del buscador flotante — puro, sin i18n ni ruteo. Los llamadores
 * (`search-overlay.tsx`) resuelven `useCategoryLabel()` y arman los `href`
 * antes de llamar acá; esta capa solo puntúa y ordena strings ya
 * etiquetados y ya normalizados.
 */
export type SearchGroup = "transactions" | "accounts" | "categories" | "payees";

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string | undefined;
  /** Texto ya formateado a mostrar a la derecha (ej. el monto de un movimiento). */
  meta?: string | undefined;
  icon: string;
  href: string;
  score: number;
  /** Para desempatar entre resultados con el mismo score, ej. fecha del movimiento. */
  sortKey?: string | undefined;
}

export interface Searchable {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string | undefined;
  meta?: string | undefined;
  icon: string;
  href: string;
  sortKey?: string | undefined;
}

/** NFD + sin diacríticos + minúsculas — sin esto "cafe" no encuentra "Café", y la app es ES/PT. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * `hay` y `needle` ya vienen normalizados por el caller. Exacto 100,
 * prefijo 80, prefijo de alguna palabra 60, substring 40, sin match null.
 */
export function scoreMatch(hay: string, needle: string): number | null {
  if (!needle) return null;
  if (hay === needle) return 100;
  if (hay.startsWith(needle)) return 80;
  if (hay.split(/\s+/).some((word) => word.startsWith(needle))) return 60;
  if (hay.includes(needle)) return 40;
  return null;
}

export function searchAll(query: string, items: Searchable[], opts?: { perGroup?: number }): SearchResult[] {
  const needle = normalize(query);
  if (!needle) return [];
  const perGroup = opts?.perGroup ?? 5;

  const scored = items
    .map((item) => {
      const score = Math.max(scoreMatch(normalize(item.title), needle) ?? 0, item.subtitle ? (scoreMatch(normalize(item.subtitle), needle) ?? 0) : 0);
      return score > 0 ? { ...item, score } : null;
    })
    .filter((r): r is SearchResult => r !== null);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.sortKey !== undefined && b.sortKey !== undefined) return a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const perGroupCount = new Map<SearchGroup, number>();
  const capped: SearchResult[] = [];
  for (const result of scored) {
    const count = perGroupCount.get(result.group) ?? 0;
    if (count >= perGroup) continue;
    perGroupCount.set(result.group, count + 1);
    capped.push(result);
  }
  return capped;
}
