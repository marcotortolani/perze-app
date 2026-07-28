import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { PerzeDatabase } from "./client";
import type { CategoryRow } from "./schema";

describe("PerzeDatabase — schema abre y hace CRUD básico", () => {
  let db: PerzeDatabase | null = null;

  afterEach(async () => {
    await db?.delete();
    db = null;
  });

  it("abre sin tirar error", async () => {
    db = new PerzeDatabase("perze-test-open");
    await db.open();
    expect(db.isOpen()).toBe(true);
  });

  it("guarda y lee una cuenta con montos en bigint", async () => {
    db = new PerzeDatabase("perze-test-accounts");
    await db.accounts.add({
      id: "acc-1",
      householdId: "hh-1",
      ownerId: "user-1",
      name: "Efectivo",
      kind: "cash",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "UYU",
      openingBalance: 500000n,
      openingDate: "2026-07-01",
      currentBalance: 500000n,
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      sortOrder: 0,
      archivedAt: null,
      createdBy: "user-1",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      deletedAt: null,
    });

    const row = await db.accounts.get("acc-1");
    expect(row?.currentBalance).toBe(500000n);
    expect(typeof row?.currentBalance).toBe("bigint");
  });

  it("consulta transacciones por household + fecha con el índice compuesto", async () => {
    db = new PerzeDatabase("perze-test-transactions");
    await db.transactions.bulkAdd([
      {
        id: "tx-1",
        householdId: "hh-1",
        createdBy: "user-1",
        kind: "expense",
        occurredAt: "2026-07-20T12:00:00.000Z",
        accountId: "acc-1",
        counterAccountId: null,
        amount: 1000n,
        currencyCode: "UYU",
        fxRate: null,
        fxSource: "identity",
        fxProvider: null,
        fxQuoteKind: null,
        fxResolvedAt: null,
        amountBase: 1000n,
        counterAmount: null,
        counterCurrencyCode: null,
        counterFxRate: null,
        categoryId: null,
        payeeId: null,
        note: null,
        attachments: [],
        location: null,
        status: "cleared",
        visibility: "household",
        recurringId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentTotal: null,
        createdAt: "2026-07-20T12:00:00.000Z",
        updatedAt: "2026-07-20T12:00:00.000Z",
        deletedAt: null,
        clientRev: 1,
        source: "manual",
      },
    ]);

    const rows = await db.transactions
      .where("[householdId+occurredAt]")
      .between(["hh-1", ""], ["hh-1", "￿"])
      .toArray();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(1000n);
  });

  it("version(2) backfillea i18nKey en categorías v1 y deja null en las que no matchean", async () => {
    const dbName = "perze-test-category-i18n-migration";

    // Simula datos preexistentes de antes de que existiera `i18nKey`,
    // escritos contra el schema de `version(1)` únicamente.
    const legacy = new Dexie(dbName);
    legacy.version(1).stores({
      categories: "id, householdId, [householdId+kind], parentId, archivedAt",
    });
    await legacy.open();
    await legacy.table("categories").bulkAdd([
      { id: "cat-1", householdId: "hh-1", parentId: null, name: "Supermercado", icon: "shopping-cart", color: "var(--data-1)", kind: "expense", nature: "variable", isSystem: true, sortOrder: 0, archivedAt: null },
      { id: "cat-2", householdId: "hh-1", parentId: null, name: "Mi categoría custom", icon: "tag", color: "var(--data-2)", kind: "expense", nature: "variable", isSystem: false, sortOrder: 1, archivedAt: null },
    ]);
    legacy.close();

    db = new PerzeDatabase(dbName);
    await db.open();
    const rows = await db.categories.toArray();
    const byId = new Map<string, CategoryRow>(rows.map((r) => [r.id, r]));

    expect(byId.get("cat-1")?.i18nKey).toBe("groceries");
    expect(byId.get("cat-2")?.i18nKey).toBeNull();
    expect(byId.get("cat-2")?.name).toBe("Mi categoría custom");
  });
});
