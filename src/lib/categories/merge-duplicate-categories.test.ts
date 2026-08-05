import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { categoriesRepo } from "../repos/categories-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { accountsRepo } from "../repos/accounts-repo";
import { payeesRepo } from "../repos/payees-repo";
import { categorizationRulesRepo } from "../repos/categorization-rules-repo";
import type { AccountRow, TransactionRow } from "../db/schema";
import { mergeDuplicateCategories } from "./merge-duplicate-categories";

const HOUSEHOLD = "hh-1";
const USER = "user-1";

function baseAccount(overrides: Partial<AccountRow> = {}): Parameters<typeof accountsRepo.create>[0] {
  return {
    householdId: HOUSEHOLD,
    ownerId: USER,
    name: "Cuenta",
    kind: "checking",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 0n,
    openingDate: "2026-07-01",
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    archivedAt: null,
    createdBy: USER,
    ...overrides,
  };
}

function baseTx(overrides: Partial<TransactionRow>): Parameters<typeof transactionsRepo.create>[0] {
  return {
    householdId: HOUSEHOLD,
    createdBy: USER,
    kind: "expense",
    occurredAt: "2026-07-20T12:00:00.000Z",
    accountId: "",
    counterAccountId: null,
    amount: 1000n,
    currencyCode: "UYU",
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
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
    source: "manual",
    ...overrides,
  };
}

async function category(overrides: Partial<Parameters<typeof categoriesRepo.create>[0]> = {}) {
  return categoriesRepo.create({
    householdId: HOUSEHOLD,
    parentId: null,
    name: "Supermercado",
    i18nKey: null,
    icon: "cart",
    color: "var(--data-1)",
    kind: "expense",
    nature: "variable",
    isSystem: false,
    sortOrder: 0,
    visibility: "household",
    ownerId: null,
    createdBy: USER,
    ...overrides,
  });
}

describe("mergeDuplicateCategories", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-merge-duplicates-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("sin duplicados, no hace nada", async () => {
    await category({ name: "Supermercado" });
    await category({ name: "Transporte" });

    const result = await mergeDuplicateCategories(HOUSEHOLD);

    expect(result.mergedCount).toBe(0);
    expect(await categoriesRepo.list(HOUSEHOLD)).toHaveLength(2);
  });

  it("el caso reportado: 'Supermercado' con movimientos y sin hijas se queda con las de la duplicada con 3 hijas y 0 movimientos", async () => {
    const account = await accountsRepo.create(baseAccount());
    const used = await category({ name: "Supermercado" });
    await transactionsRepo.create(baseTx({ accountId: account.id, categoryId: used.id }));

    const withChildren = await category({ name: "Supermercado" });
    const pantry = await category({ name: "Almacén", parentId: withChildren.id });
    const produce = await category({ name: "Verdulería", parentId: withChildren.id });
    const butcher = await category({ name: "Carnicería", parentId: withChildren.id });

    const result = await mergeDuplicateCategories(HOUSEHOLD);

    expect(result.mergedCount).toBe(1);
    const after = await categoriesRepo.list(HOUSEHOLD);
    // La titular ("used", con el movimiento) sobrevive; la duplicada se archivó.
    expect(after.find((c) => c.id === used.id)).toBeDefined();
    expect(after.find((c) => c.id === withChildren.id)).toBeUndefined();
    // Las 3 hijas se reparentan a la titular — no había hijas homónimas ahí.
    for (const child of [pantry, produce, butcher]) {
      const reparented = after.find((c) => c.id === child.id);
      expect(reparented?.parentId).toBe(used.id);
    }
  });

  it("hijas homónimas en ambos duplicados se fusionan entre sí, no se reparentan", async () => {
    const primaryRoot = await category({ name: "Transporte" });
    const primaryFuel = await category({ name: "Nafta", parentId: primaryRoot.id });
    const account = await accountsRepo.create(baseAccount());
    await transactionsRepo.create(baseTx({ accountId: account.id, categoryId: primaryRoot.id }));

    const dupRoot = await category({ name: "Transporte" });
    const dupFuel = await category({ name: "Nafta", parentId: dupRoot.id });
    await transactionsRepo.create(baseTx({ accountId: account.id, categoryId: dupFuel.id }));

    await mergeDuplicateCategories(HOUSEHOLD);

    const after = await categoriesRepo.list(HOUSEHOLD);
    // Solo una "Nafta" activa (la titular) — la duplicada se archivó.
    expect(after.filter((c) => c.name === "Nafta")).toHaveLength(1);
    expect(after.find((c) => c.id === dupFuel.id)).toBeUndefined();
    // El movimiento de la "Nafta" duplicada se reasignó a la titular.
    const fuelTx = await transactionsRepo.list(HOUSEHOLD, { categoryId: primaryFuel.id });
    expect(fuelTx).toHaveLength(1);
  });

  it("reasigna defaultCategoryId de un comercio a la titular", async () => {
    const primary = await category({ name: "Restaurantes" });
    const account = await accountsRepo.create(baseAccount());
    await transactionsRepo.create(baseTx({ accountId: account.id, categoryId: primary.id }));
    const duplicate = await category({ name: "Restaurantes" });
    const payee = await payeesRepo.create({ householdId: HOUSEHOLD, name: "Café X", defaultCategoryId: duplicate.id, defaultAccountId: null, logoUrl: null, aliases: [] });

    await mergeDuplicateCategories(HOUSEHOLD);

    const updatedPayee = (await payeesRepo.list(HOUSEHOLD)).find((p) => p.id === payee.id);
    expect(updatedPayee?.defaultCategoryId).toBe(primary.id);
  });

  it("reasigna una regla de auto-categorización (categoryId anidado en actions) a la titular", async () => {
    const account = await accountsRepo.create(baseAccount());
    const primary = await category({ name: "Salud" });
    await transactionsRepo.create(baseTx({ accountId: account.id, categoryId: primary.id }));
    const duplicate = await category({ name: "Salud" });
    const rule = await categorizationRulesRepo.create({
      householdId: HOUSEHOLD,
      name: "Farmacia -> Salud",
      priority: 0,
      match: { field: "note", op: "contains", value: "farmacia" },
      actions: { categoryId: duplicate.id, tagIds: [], payeeId: null },
      isActive: true,
      createdBy: USER,
    });

    await mergeDuplicateCategories(HOUSEHOLD);

    const updatedRule = (await categorizationRulesRepo.list(HOUSEHOLD)).find((r) => r.id === rule.id);
    expect(updatedRule?.actions.categoryId).toBe(primary.id);
  });

  it("es idempotente: correrlo dos veces seguidas la segunda vez no hace nada", async () => {
    await category({ name: "Vivienda" });
    await category({ name: "Vivienda" });

    const first = await mergeDuplicateCategories(HOUSEHOLD);
    const second = await mergeDuplicateCategories(HOUSEHOLD);

    expect(first.mergedCount).toBe(1);
    expect(second.mergedCount).toBe(0);
  });
});
