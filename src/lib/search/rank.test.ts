import { describe, expect, it } from "vitest";
import { normalize, scoreMatch, searchAll, type Searchable } from "./rank";

describe("normalize", () => {
  it("saca diacríticos y pasa a minúsculas", () => {
    expect(normalize("Café")).toBe("cafe");
    expect(normalize("SUPERMERCADO")).toBe("supermercado");
  });
});

describe("scoreMatch", () => {
  it("puntúa exacto > prefijo > prefijo de palabra > substring", () => {
    expect(scoreMatch("cafe", "cafe")).toBe(100);
    expect(scoreMatch("cafeteria", "cafe")).toBe(80);
    expect(scoreMatch("mi cafe favorito", "cafe")).toBe(60);
    expect(scoreMatch("descafeinado", "cafe")).toBe(40);
  });

  it("sin match devuelve null", () => {
    expect(scoreMatch("supermercado", "cafe")).toBeNull();
  });

  it("con needle vacío devuelve null", () => {
    expect(scoreMatch("cafe", "")).toBeNull();
  });
});

describe("searchAll", () => {
  const items: Searchable[] = [
    { id: "tx-1", group: "transactions", title: "Café", href: "/transactions?tx=tx-1", icon: "cart", sortKey: "2026-07-01" },
    { id: "tx-2", group: "transactions", title: "Cafetería del centro", href: "/transactions?tx=tx-2", icon: "cart", sortKey: "2026-07-10" },
    { id: "acc-1", group: "accounts", title: "Cuenta Café", href: "/accounts?account=acc-1", icon: "wallet" },
  ];

  it("encuentra 'cafe' sin acento contra 'Café' con acento", () => {
    const results = searchAll("cafe", items);
    expect(results.map((r) => r.id)).toContain("tx-1");
    expect(results.map((r) => r.id)).toContain("acc-1");
  });

  it("ordena por score y desempata por sortKey descendente", () => {
    const results = searchAll("cafe", items);
    const tx1 = results.find((r) => r.id === "tx-1")!;
    const tx2 = results.find((r) => r.id === "tx-2")!;
    expect(tx1.score).toBeGreaterThan(tx2.score); // exacto > prefijo de palabra
  });

  it("limita a perGroup por grupo", () => {
    const many: Searchable[] = Array.from({ length: 10 }, (_, i) => ({
      id: `tx-${i}`,
      group: "transactions" as const,
      title: "Café",
      href: `/transactions?tx=tx-${i}`,
      icon: "cart",
    }));
    const results = searchAll("cafe", many, { perGroup: 3 });
    expect(results).toHaveLength(3);
  });

  it("con query vacía devuelve nada", () => {
    expect(searchAll("", items)).toEqual([]);
  });

  it("D30 — encuentra por keyword (tag) aunque no aparezca en título ni subtítulo", () => {
    const withTags: Searchable[] = [
      { id: "tx-1", group: "transactions", title: "Supermercado", href: "/transactions?tx=tx-1", icon: "cart", keywords: ["Cliente", "Reembolsable"] },
      { id: "tx-2", group: "transactions", title: "Farmacia", href: "/transactions?tx=tx-2", icon: "cart", keywords: ["Personal"] },
    ];
    const results = searchAll("cliente", withTags);
    expect(results.map((r) => r.id)).toEqual(["tx-1"]);
  });
});
