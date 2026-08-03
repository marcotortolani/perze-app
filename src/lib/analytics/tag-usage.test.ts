import { describe, expect, it } from "vitest";
import { rankTagsByUsage } from "./tag-usage";
import type { TagRow, TransactionTagRow } from "@/lib/db/schema";

function tag(id: string, name = id): TagRow {
  return { id, householdId: "hh-1", name, color: null, clientRev: 1 };
}

function link(transactionId: string, tagId: string): TransactionTagRow {
  return { transactionId, tagId };
}

describe("rankTagsByUsage", () => {
  const tags = [tag("a", "aa-tag"), tag("b", "bb-tag"), tag("c", "cc-tag"), tag("d", "dd-tag")];

  it("prioriza uso real y rellena hasta el límite", () => {
    const links = [link("tx1", "b"), link("tx2", "b"), link("tx3", "a")];
    const ranked = rankTagsByUsage(tags, links, 3);
    expect(ranked.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("sin ningún uso, cae al orden por id", () => {
    const ranked = rankTagsByUsage(tags, [], 2);
    expect(ranked.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("nunca duplica un tag entre uso y relleno", () => {
    const links = [link("tx1", "c")];
    const ranked = rankTagsByUsage(tags, links, 4);
    expect(new Set(ranked.map((t) => t.id)).size).toBe(4);
  });

  it("un tag usado en varios movimientos distintos suma cada aparición", () => {
    const links = [link("tx1", "d"), link("tx2", "d"), link("tx3", "d"), link("tx4", "a")];
    const ranked = rankTagsByUsage(tags, links, 1);
    expect(ranked.map((t) => t.id)).toEqual(["d"]);
  });
});
